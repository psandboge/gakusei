const {test,expect,text}=require('../support/fixture');
const {lesson}=require('../../../fixtures/migration-parity/api');
const strokes=require('../../../fixtures/migration-parity/strokes.json');
const fs=require('node:fs');
const path=require('node:path');
async function begin(page,app){
  await page.goto(app.origin+'/select/kanji');
  await page.locator('.exercise').filter({has:page.getByRole('heading',{name:new RegExp("^"+lesson.name)})}).locator('.exercise__actions button').click();
  await expect(page.locator('canvas')).toBeVisible();
  await expect.poll(()=>app.requests.filter(r=>r.path==='/img/kanji/kanjivg/04e00.svg').length).toBeGreaterThan(0);
}
async function stroke(page,kind){
  const canvas=page.locator('canvas'); const box=await canvas.boundingBox();
  const points=strokes[kind].map(([x,y])=>({x:box.x+x/109*box.width,y:box.y+y/109*box.height}));
  if(kind==='mouse'){
    await page.mouse.move(points[0].x,points[0].y); await page.mouse.down();
    for(const point of points) await page.mouse.move(point.x,point.y);
    await page.mouse.up();
  } else {
    // DOM input events exercise the shipped touch adapter; no component access.
    await canvas.dispatchEvent('touchstart',{touches:[{identifier:1,clientX:points[0].x,clientY:points[0].y}]});
    for(const point of points) await canvas.dispatchEvent('touchmove',{touches:[{identifier:1,clientX:point.x,clientY:point.y}]});
    await canvas.dispatchEvent('touchend',{touches:[]});
  }
}
for(const kind of ['mouse','touch']) test(`P0-DRAW-${kind}: simulated one-line score, resize, export, reset/remount`,async({page,app})=>{
  app.respond('GET','/img/kanji/kanjivg/04e00.svg',()=>({body:fs.readFileSync(path.join(__dirname,'../../../fixtures/migration-parity/one-line.svg'),'utf8'),raw:true,headers:{'Content-Type':'image/svg+xml'}}));
  await begin(page,app);
  await page.setViewportSize({width:700,height:900});
  await stroke(page,kind);
  const drawnBox=await page.locator('canvas').boundingBox();
  const yes=page.locator('[name="answerbutton-1"]');
  await expect(yes).toBeVisible(); // One known scoring/completion result.
  await yes.click();
  await expect.poll(()=>app.requests.filter(r=>r.path==='/api/kanji-drawings').length).toBe(1);
  const upload=app.requests.find(r=>r.path==='/api/kanji-drawings').body;
  expect(upload.nuggetid).toBe(9001); expect(upload.username).toBe('P0Alice');
  const lines=JSON.parse(upload.data);
  expect(lines).toHaveLength(1); expect(lines[0].length).toBeGreaterThan(1);
  const box=await page.locator('canvas').boundingBox();
  expect(lines[0].every(p=>p.x>=0 && p.x<=box.width && p.y>=0 && p.y<=box.height)).toBe(true);
  // Straight lines simplify to endpoints. Native MouseEvent client coordinates
  // round to CSS pixels; allow two pixels, independently on each axis.
  expect(lines[0]).toHaveLength(2);
  for(const [index,point] of [strokes[kind][0],strokes[kind].at(-1)].entries()){
    expect(Math.abs(lines[0][index].x-point[0]/109*drawnBox.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(lines[0][index].y-point[1]/109*drawnBox.height)).toBeLessThanOrEqual(2);
  }
  await expect(page.getByText(/Fråga 2 \/ 2/)).toBeVisible();
  await expect(page.locator('[name="answerbutton-1"]')).toHaveCount(0);
  await page.goto(app.origin+'/about'); await begin(page,app);
  await stroke(page,kind); await expect(yes).toBeVisible(); await yes.click();
  await expect.poll(()=>app.requests.filter(r=>r.path==='/api/kanji-drawings').length).toBe(2);
  expect(JSON.parse(app.requests.filter(r=>r.path==='/api/kanji-drawings')[1].body.data)).toHaveLength(1);
});
