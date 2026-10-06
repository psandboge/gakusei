"""Shared strict JDK/build evidence contract for the two current proof pairs."""
import hashlib
import json
import os
from pathlib import Path
import platform
import re
import subprocess
import zipfile
import xml.etree.ElementTree as ET

SCHEMA = 'gakusei.upgrade-build.v2'
BUILD_COMMAND = ['./mvnw', '-B', '-ntp', '-Pproduction', '-DskipTests', 'clean', 'package']
PINS = {
    ('Darwin', 'arm64', 17): ('aarch64_mac', '17.0.16', '8', 'f9845abc8403f1d489402201064e7b9f2c57605d8717b85a95a15d94f882eeb7', 'mac-arm64'),
    ('Darwin', 'arm64', 25): ('aarch64_mac', '25.0.4.1', '1', '61979887f7506a24a57439ff99adb8b3a7fc89977d9cfe3b8984f58a981b7b9d', 'mac-arm64'),
    ('Linux', 'x86_64', 17): ('x64_linux', '17.0.16', '8', '166774efcf0f722f2ee18eba0039de2d685b350ee14d7b69e6f83437dafd2af1', 'linux-x64'),
    ('Linux', 'x86_64', 25): ('x64_linux', '25.0.4.1', '1', 'dbb698396d478e7fa2b1e50f4103324b2a99b90569ee27c33f2261f9215cf41e', 'linux-x64'),
}

def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()

def environment(home):
    env = {k: v for k, v in os.environ.items()
           if not k.startswith(('MAVEN_', 'SPRING_', 'LOCAL_', 'COMPOSE_', 'GAKUSEI_'))
           and k not in ('JAVA_TOOL_OPTIONS', 'JDK_JAVA_OPTIONS', '_JAVA_OPTIONS', 'JAVA_HOME', 'CLASSPATH')}
    env.update(JAVA_HOME=str(home), PATH=str(home / 'bin') + os.pathsep + env.get('PATH', ''))
    return env

def capture(command, home, cwd=None, timeout=60):
    return subprocess.run(command, cwd=cwd, env=environment(home), text=True,
                          stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                          timeout=timeout, check=True).stdout

def jdk(home, major):
    assert type(major) is int and major in (17, 25)
    home = Path(home)
    assert home.is_absolute() and home.resolve() == home and home.is_dir(), 'Canonical JDK home required'
    arch, version, build, archive_sha, label = PINS[(platform.system(), platform.machine(), major)]
    url = (f'https://github.com/adoptium/temurin{major}-binaries/releases/download/'
           f'jdk-{version}%2B{build}/OpenJDK{major}U-jdk_{arch}_hotspot_{version}_{build}.tar.gz')
    receipt = home / 'gakusei-jdk-receipt.json'
    assert receipt.is_file() and not receipt.is_symlink(), 'Verified extraction receipt required'
    data = json.loads(receipt.read_text())
    expected = dict(schema='gakusei.jdk-install.v1', home=str(home), major=major, platform=label,
                    archive_url=url, archive_sha256=archive_sha, full_version=version+'+'+build,
                    vendor='Eclipse Adoptium',
                    executables={name: digest(home/'bin'/name) for name in ('java', 'javac', 'jcmd')})
    assert data == expected, 'Unverified or tampered JDK installation'
    java = capture([str(home/'bin/java'), '-XshowSettings:properties', '-version'], home)
    javac = capture([str(home/'bin/javac'), '-version'], home)
    assert f'java.version = {version}' in java and 'java.vendor = Eclipse Adoptium' in java
    assert f'java.home = {home}' in java and f'javac {version}' in javac
    return dict(home=str(home), major=major, platform=label, vendor=data['vendor'],
                full_version=data['full_version'], archive_url=url, archive_sha256=archive_sha,
                receipt_sha256=digest(receipt), executables=data['executables'],
                **{name: str(home/'bin'/name) for name in ('java','javac','jcmd')},
                java_observation=java, javac_observation=javac)

def classes(jar, release):
    values = set()
    count = 0
    with zipfile.ZipFile(jar) as archive:
        for name in archive.namelist():
            if name.startswith('BOOT-INF/classes/') and name.endswith('.class'):
                header = archive.read(name)[:8]
                assert header[:4] == b'\xca\xfe\xba\xbe', 'Malformed class'
                minor, major = int.from_bytes(header[4:6], 'big'), int.from_bytes(header[6:8], 'big')
                assert major == release + 44 and minor == 0, 'Wrong compiler target or preview class'
                values.add((major, minor))
                count += 1
    assert count > 0, 'Application bytecode required'
    return dict(application_count=count, versions=[dict(major=a, minor=b) for a,b in sorted(values)])

def maven(root, home, expected_release):
    # Neither Maven user toolchains nor per-repository override files may select another JVM/compiler.
    assert not (Path.home()/'.m2/toolchains.xml').exists(), 'Maven user toolchain selection forbidden'
    for name in ('.mvn/jvm.config', '.mvn/maven.config', '.mvn/extensions.xml'):
        assert not (root/name).exists(), 'Unattested Maven override: ' + name
    version = capture(['./mvnw', '-B', '-ntp', '--version'], home, root)
    assert 'Apache Maven 3.9.16' in version and f'Java version: {expected_release}.' in version
    assert str(home) in version
    effective = capture(['./mvnw', '-B', '-ntp', 'help:effective-pom'], home, root, timeout=180)
    start, end = effective.index('<project '), effective.rindex('</project>') + len('</project>')
    project = ET.fromstring(effective[start:end])
    ns = {'m':'http://maven.apache.org/POM/4.0.0'}
    release = project.findtext('m:properties/m:maven.compiler.release', namespaces=ns)
    assert release == str(expected_release), 'Unexpected effective compiler release'
    plugins = {}
    for plugin in project.findall('.//m:plugin', ns):
        name = plugin.findtext('m:artifactId', namespaces=ns)
        if name in ('maven-compiler-plugin', 'maven-surefire-plugin', 'maven-failsafe-plugin'):
            plugins[name] = plugin.findtext('m:version', namespaces=ns)
        assert name != 'maven-toolchains-plugin', 'External compiler toolchains forbidden'
        for key in ('fork', 'executable', 'jdkToolchain', 'compilerArgs', 'argLine', 'jvm'):
            value = plugin.find('m:configuration/m:'+key, ns)
            assert value is None or (key == 'fork' and value.text == 'false'), 'Unattested JVM/compiler override'
    assert plugins.get('maven-compiler-plugin') and plugins.get('maven-surefire-plugin')
    return dict(version='3.9.16', version_observation=version, compiler_release=int(release), plugins=plugins,
                effective_pom_sha256=hashlib.sha256(effective[start:end].encode()).hexdigest())

def validate(proof, major):
    assert proof['schema'] == SCHEMA, 'Current proof requires v2 provenance'
    current = jdk(Path(proof['jdk']['home']), major)
    assert proof['jdk'] == current, 'JDK evidence changed'
    assert proof['build_command'] == BUILD_COMMAND and type(proof['build_exit']) is int and proof['build_exit'] == 0
    record = proof['maven']
    assert record['version'] == '3.9.16' and type(record['compiler_release']) is int and record['compiler_release'] == major
    assert 'Apache Maven 3.9.16' in record['version_observation']
    assert f'Java version: {major}.' in record['version_observation'] and current['home'] in record['version_observation']
    assert record['plugins'].get('maven-compiler-plugin') and record['plugins'].get('maven-surefire-plugin')
    assert re.fullmatch('[a-f0-9]{64}', record['effective_pom_sha256'])
    assert type(proof['classes']['application_count']) is int
    assert proof['classes'] == classes(proof['jar'], major)
    assert proof['maven'] == maven(Path(proof['checkout']), Path(current['home']), major), 'Compiler/Maven evidence changed'
    return current

def observe(run, proof, pair, owned, deadline):
    """Attach only to this Run's tracked PID, within its original startup budget."""
    identity = owned.pid_identity(run.process.pid)
    assert run.process.poll() is None and identity == run.r['pid_identity']
    tools = validate(proof, proof['jdk']['major'])
    remaining = deadline - __import__('time').monotonic()
    assert remaining > 0, 'Runtime observation exceeded startup budget'
    raw = capture([tools['jcmd'], str(run.process.pid), 'VM.system_properties'],
                  Path(tools['home']), timeout=min(10, remaining))
    properties = dict(line.split('=', 1) for line in raw.splitlines() if '=' in line)
    assert properties['java.home'] == tools['home'] and properties['java.vendor'] == tools['vendor']
    assert properties['java.version'] == tools['full_version'].split('+')[0]
    assert properties['sun.java.command'].split()[0] == proof['jar'], 'Observed runtime jar differs'
    assert run.process.poll() is None and owned.pid_identity(run.process.pid) == identity
    assert digest(proof['jar']) == proof['jar_sha256']
    owned.atomic(run.directory / f'runtime-{run.process.pid}-private.json',
                 dict(pair=pair, source_sha=proof['source_sha'], jar_sha256=proof['jar_sha256'],
                      launcher_sha256=tools['executables']['java'], pid=run.process.pid,
                      pid_identity=identity, jdk=tools, vm_properties=raw))
