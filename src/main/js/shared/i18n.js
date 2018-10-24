import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n.use(LanguageDetector).init({
  // we init with resources
  resources: {
    se: {
      translations: {
        //AboutScreen
        'aboutScreen.aboutGakusei.h2': 'Om Gakusei',
        'aboutScreen.aboutGakusei.p':
          'Gakusei är en webbapplikation där du kan öva dig på japanska. Applikationen har följande fyra spellägen:',
        'aboutScreen.aboutGakusei.li1':
          '"Gissa ordet" som kan hittas under fliken "Glosor". Här ska man välja rätt översättning på ett ord bland fyra alternativ.',
        'aboutScreen.aboutGakusei.li2':
          '"Bildkort" som även det kan hittas under fliken "Glosor". Här gäller det att gissa rätt på ett ord. Gissade du rätt?',
        'aboutScreen.aboutGakusei.li3': '"Quiz" och här kan du spela frågesporter kopplade till Japan.',
        'aboutScreen.aboutGakusei.li4': '"Kanji" och här kan du testa dina kunskaper i kanji.',

        //AboutScreen - rättigheter
        'aboutScreen.rights.h4': 'Rättigheter',
        'aboutScreen.rights.p': 'Utvecklad i samarbete med ',
        'aboutScreen.rights.p2':
          ' Alla rättigheter till programkoden ägs av Kokitotsos AB. Denna sajt opereras av Daigaku Sverige som licensierar Gakusei av Kokitotsos AB:s genom en öppen källkodslicens. Utbildningsmaterial har sammanställts av Pierre Sandboge, och inkluderar eget material och annat material som framgår på annan plats på den här sidan. ',
        'aboutScreen.rights.p3':
          'drivs utan anställda, med donerade medel, och ingen garanti om tillgänglighet kan ges. Tillhandahållandet av tjänsten kan upphöra när som helst utan förvarning.',

        'Läs mer': 'Läs mer',
        'Gakusei erbjuder många funktioner som underlättar ditt lärande':
          'Gakusei erbjuder många funktioner som underlättar ditt lärande',
        'Testa redan nu!': 'Testa redan nu!',
        'Registrera dig snabbt och enkelt här': 'Registrera dig snabbt och enkelt här',
        'Gissa ordet': 'Gissa ordet',
        'Om Gakusei': 'Om Gakusei',
        Språk: 'Språk',
        'Logga in / Registrera': 'Logga in / Registrera',
        'Logga in eller registrera dig': 'Logga in eller registrera dig',
        Användarnamn: 'Användarnamn',
        Lösenord: 'Lösenord',
        'Logga in': 'Logga in',
        Registrera: 'Registrera',
        'Håll mig inloggad': 'Håll mig inloggad'
      }
    },
    jp: {
      translations: {
        aboutGakusei: '',
        'aboutGakusei.aboutGakusei.h2': '学生について',
        'aboutGakusei.aboutGakusei.p':
          '学生は、日本語で練習できるWebアプリケーションです。アプリケーションには、次の4つのゲームモードがあります。',
        'aboutGakusei.aboutGakusei.li1':
          'スペルのタブの下にある単語を推測してください。 ここでは、4つのオプションの中から1つの単語の正しい翻訳を選択する必要があります。',
        'aboutGakusei.aboutGakusei.li2':
          'スペルチェックタブの下にある絵カード。 1つの単語を推測するという質問があります。 あなたは正しいと思いましたか？',
        'aboutGakusei.aboutGakusei.li3': 'Quiz och här kan du spela frågesporter kopplade till Japan.',
        'aboutGakusei.aboutGakusei.li4': '&quot;Kanji&quot; och här kan du testa dina kunskaper i kanji.',
        'aboutgakusei.rights': '',
        'aboutGakusei.rights.h4': '権利',
        'aboutGakusei.rights.p': '協力して開発',
        'aboutGakusei.rights.link': 'KITS AB',
        'aboutGakusei.rights.p2':
          '. プログラムコードのすべての権利は、Kokitotsos ABによって所有されています。 このサイトは、スウェーデン大学図書館が運営しています。スウェーデンは、Kokitotsos ABによる学生のライセンスをオープンソースライセンスで提供しています。 教育資料は、Pierre Sandbogeによって編集されており、このページの他の場所に示されている自分自身の資料やその他の資料が含まれています。',
        'aboutGakusei.rights.link2': 'Daigaku.se',
        'aboutGakusei.rights.p3':
          '従業員なしで運営され、寄付された資金で運営され、可用性の保証はありません。 サービスの提供は、通知なしにいつでも終了することができます。',
        'aboutGakusei.licenses': '',
        'aboutGakusei.licenses.licens': 'ライセンス',
        'aboutGakusei.licenses.modul': 'モジュール',
        'aboutGakusei.licenses.version': 'バージョン：',
        'aboutGakusei.licenses.repo': 'リポジトリ：',
        'aboutGakusei.licenses.licenses': 'ライセンス',
        'aboutGakusei.licenses.p': '学生用アプリはライセンス契約に基づいています',
        'aboutGakusei.licenses.link': 'MIT',
        'aboutGakusei.licenses.p2': '. 以下は、プロジェクトが使用するモジュールのライセンス一覧です。',
        'aboutGakusei.licenses.panelToggle': 'その他のライセンスはここをクリック',
        'aboutGakusei.infoBanner': '',
        'aboutGakusei.infoBanner.contributors': '',
        'aboutGakusei.infoBanner.contributors.contributors': '協力者',
        'aboutGakusei.infoBanner.contributors.p3': '誰がプロジェクトに貢献したかを見る',
        'aboutGakusei.infoBanner.contributors.link2': 'ここに',
        'aboutGakusei.infoBanner.github': '',
        'aboutGakusei.infoBanner.github.github': 'ギブス',
        'aboutGakusei.infoBanner.github.p': 'オープンソースプロジェクトをご覧ください',
        'aboutGakusei.infoBanner.github.link': 'ページ。',
        'aboutGakusei.infoBanner.owner': '',
        'aboutGakusei.infoBanner.owner.owner': '所有権',
        'aboutGakusei.infoBanner.owner.p': 'プログラムコードのすべての権利は、Kokitotsos ABによって所有されています。',
        grammarScreen: '',
        homeScreen: '',
        'homeScreen.rightAnswer': '正しい答えを共有してください！',
        'homeScreen.wrongAnswer': '間違った答えを共有する',
        'homeScreen.favLesson': 'お気に入りのレッスン',
        'homeScreen.progressbar': 'クリアされた％',
        'homeScreen.quiestionLeft': 'あなたはそれをやった ',
        'homeScreen.of': ' の ',
        'homeScreen.words': ' 単語 ',
        'homeScreen.gameNav': 'メニューのゲームタイプに移動してレッスンを追加します。',
        'homeScreen.welcomeUser': 'ようこそ、 ',
        'homeScreen.userStatics': 'あなたの応答の統計：',
        'homeScreen.loading': '充填...',
        loginScreen: '',
        'loginScreen.registerTitel': 'ここにすばやく簡単に登録する',
        'loginScreen.p1': '私たちは個人情報を保存しませんので、パスワードを覚えておいてください。',
        'loginScreen.p2': 'この資料はスウェーデン語に適合しており、スウェーデン語から日本語、スウェーデン語',
        'loginScreen.signUp': 'ログインまたは登録',
        'loginScreen.Form': '',
        'loginScreen.Form.placeholderName': 'ユーザー名',
        'loginScreen.Form.placehoolderPassword': 'パスワード',
        'loginScreen.login': '',
        'loginScreen.login.login': 'ログイン',
        'loginScreen.login.register': 'サインアップ',
        'loginScreen.login.rememberMe': '私をログインさせておく',
        logoutScreen: '',
        playScreen: '',
        selectScreen: '',
        'selectScreen.pageHeader': '',
        'selectScreen.pageHeader.quiz': '考査',
        'selectScreen.pageHeader.guess': '単語を推測する',
        'selectScreen.pageHeader.translate': '言葉を翻訳する',
        'selectScreen.pageHeader.flashcards': 'フォトカード',
        'selectScreen.pageHeader.kanji': 'タイプ漢字',
        'selectScreen.pageHeader.grammar': '曲げ動詞',
        'selectScreen.pageHeader.error': 'No play type specified',
        'selectScreen.pageDescription': '',
        'selectScreen.pageDescription.quiz': '正しい翻訳のために4つの回答オプションを選択します',
        'selectScreen.pageDescription.guess': 'Välj mellan 4 svarsalternativ för den korrekta översättningen.',
        'selectScreen.pageDescription.translate': '表示された単語をフリーテキストに翻訳します。',
        'selectScreen.pageDescription.flashcards':
          'Träna dig själv genom att använda kort, med frågan på ena sidan och rätta svaret på den andra.',
        'selectScreen.pageDescription.kanji':
          'カードを使って自分の身体を鍛えましょう。片方の質問ともう片方の答えを修正してください。',
        'selectScreen.pageDescription.grammar': '表示された単語を、指定された動詞形式のフリーテキストに収めます。',
        'selectScreen.pageDescription.error': '再生タイプが指定されていません',
        'selectScreen.getLessons': '',
        'selectScreen.getLessons.lessons': 'レッスン',
        'selectScreen.getLessons.tooltopRed': '反復する必要がある質問',
        'selectScreen.getLessons.tooltipBlue': '未解決の質問',
        'selectScreen.getLessons.toolTipIncor': 'スペルの間違いの数',
        'selectScreen.getLessons.smartLearaning': 'スマート学習モード',
        'selectScreen.getLessons.on': '上の',
        'selectScreen.getLessons.of': 'の',
        'selectScreen.getLessons.drawEasy': 'シンプル - パスに従う',
        'selectScreen.getLessons.drawMeduim': 'ミディアム - ヘルプ付きで描画',
        'selectScreen.getLessons.drawHard': '難しい - フリーハンドで描く',
        'selectScreen.getLessons.panel': '',
        'selectScreen.getLessons.panel.mixedQuestion': '混在した質問',
        'selectScreen.getLessons.panel.mixedFavLession':
          'あなたのお気に入りのレッスンのすべてからの質問を混ぜてください',
        'wselectScreen.getLessons.panel.rongQuestion': '間違った答え',
        'selectScreen.getLessons.panel.failedQuestions': 'あなたが間違って答えたすべての質問がここにあります。',
        'selectScreen.displayLessions': '',
        'selectScreen.displayLessions.lessonFav': '進行中のレッスン',
        'selectScreen.displayLessions.lessonFavDone': '完了したレッスン',
        'selectScreen.displayLessions.otherLesson': 'その他のレッスン',
        startScreen: '',
        'startScreen.navigation': '',
        'startScreen.header': '',
        'startScreen.header.introductionTitle': '学生になって日本語を学ぶ！',
        'startScreen.jumbotronBanner': '',
        'startScreen.jumbotronBanner.colOne': '',
        'startScreen.jumbotronBanner.colOne.h2': '学生はあなたの学習を促進する多くの機能を提供しています',
        'startScreen.aboutFeatureImage': '',
        'startScreen.aboutFeatureImage.colTwo': '',
        'startScreen.aboutFeatureImage.colTwo.h3': '教えることの良い補足',
        'startScreen.aboutFeatureImage.colTwo.p': '大学レベルの日本の教育に適応したさまざまなタイプの練習。',
        'startScreen.aboutFeatureImage.colThree': '',
        'startScreen.aboutFeatureImage.colThree.h3': 'どこでもどこでも',
        'startScreen.aboutFeatureImage.colFour': '',
        'startScreen.aboutFeatureImage.colFour.h3': '匿名',
        'startScreen.aboutFeatureImage.colFour.p':
          '学生はユーザーの個人情報を保管していません。必要なのはユーザー名だけです。',
        'startScreen.aboutFeatureImage.colFive': '',
        'startScreen.aboutFeatureImage.colFive.h3': '除去する',
        'startScreen.aboutFeatureImage.colFive.p': 'クイズをして、日本について何ができるか見てみましょう。',
        'startScreen.aboutFeatureImage.colSix': '',
        'startScreen.aboutFeatureImage.colSix.h3': 'スマートな学習技術',
        'startScreen.aboutFeatureImage.colSix.p':
          '私たちのシステムは質問にどのように答えたかを記憶していますので、学習教材をカスタマイズすることができます。',
        'startScreen.jumbotronBannerDaigaku': '',
        'startScreen.jumbotronBannerDaigaku.h2': '大學スウェーデン、学術振興',
        'startScreen.jumbotronBannerDaigaku.p':
          '大学スウェーデンは、日本語での教授と研究の促進を目指しています。 今日、日本人は英語で学ぶ必要があります。 私たちは、スウェーデン語から日本語に直接いくつかの学習を直接行うことができれば有利だと思います。 そのため、スウェーデン語で日本語を教える最初のWebアプリケーションであるGakuseiを作成しました。',
        'startScreen.jumbotronRegister': '',
        'startScreen.jumbotronRegister.h2': '学生と知識を広げる',
        appScreen: '',
        'appScreen.copyrightText': '©Gakusei 2018  - すべての権利を保有します。',
        numbers: '',
        zero: '0',
        one: '1',
        two: '2',
        three: '3',
        four: '4',
        five: '5',
        six: '6',
        seven: '7',
        eight: '8',
        nine: '9',
        button: '',
        readMore: 'もっと読む',
        tryNow: '今すぐ試してみてください！',
        register: '今すぐサインアップ！'
      }
    }
  },
  fallbackLng: 'se',
  debug: true,

  // have a common namespace used around the full app
  ns: ['translations'],
  defaultNS: 'translations',

  keySeparator: false, // we use content as keys

  interpolation: {
    escapeValue: false, // not needed for react!!
    formatSeparator: ','
  },

  react: {
    wait: true
  }
});

export default i18n;
