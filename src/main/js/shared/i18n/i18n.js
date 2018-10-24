import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n.use(LanguageDetector).init({
  // we init with resources
  resources: {
    se: {
      translations: {
        aboutScreen: {
          aboutGakusei: {
            h2: 'Om Gakusei',
            p:
              ' Gakusei är en webbapplikation där du kan öva dig på japanska. Applikationen har följande fyra spellägen:',
            li1:
              '&quot;Gissa ordet&quot; som kan hittas under fliken &quot;Glosor&quot;. Här ska man välja rätt översättning på ett ord bland fyra alternativ.',
            li2:
              '&quot;Bildkort&quot; som även det kan hittas under fliken &quot;Glosor&quot;. Här gäller det att gissa rätt på ett ord. Gissade du rätt?',
            li3: '&quot;Quiz&quot; och här kan du spela frågesporter kopplade till Japan.',
            li4: '&quot;Kanji&quot; och här kan du testa dina kunskaper i kanji.'
          },
          rights: {
            h4: 'Rättigheter',
            p: 'Utvecklad i samarbete med',
            link: 'KITS AB',
            p2:
              '. Alla rättigheter till programkoden ägs av Kokitotsos AB. Denna sajt opereras av Daigaku Sverige som licensierar Gakusei av Kokitotsos AB:s genom en öppen källkodslicens. Utbildningsmaterial har sammanställts av Pierre Sandboge, och inkluderar eget material och annat material som framgår på annan plats på den här sidan.',
            link2: 'Daigaku.se',
            p3:
              'drivs utan anställda, med donerade medel, och ingen garanti om tillgänglighet kan ges. Tillhandahållandet av tjänsten kan upphöra när som helst utan förvarning.'
          },
          licenses: {
            licens: 'Licenser',
            modul: 'modul',
            version: 'Version:',
            repo: 'Repository:',
            licenses: 'Licens(er):',
            p: 'Webbappen Gakusei går under licensen',
            link: 'MIT',
            p2: '. Nedan följer en lista på licenser för de moduler som projektet använder sig av.',
            panelToggle: 'Klicka för fler Licenser'
          },
          infoBanner: {
            contributors: {
              contributors: 'Medverkande',
              p3: 'Se vilka som bidragit till projektet',
              link2: 'här'
            },
            github: {
              github: 'github',
              p: 'Besök gärna open-source projektets',
              link: 'Githubsida.'
            },
            owner: {
              owner: 'Ägande',
              p: 'Alla rättigheter till programkoden ägs av Kokitotsos AB.'
            }
          }
        },
        finishScreen: {
          correct: '% rätt!',
          rightAnswer: ' Du svarade rätt på ',
          witch: 'av ',
          sumQuestion: ' möjliga frågor',
          tryAgain: 'Försök igen',
          button: 'Välj nya frågor'
        },
        grammarScreen: {},
        homeScreen: {
          rightAnswer: 'Andel rätt svar!',
          wrongAnswer: 'Andel fel svar',
          favLesson: 'Dina favoritlektioner',
          progressbar: '% avklarat',
          quiestionLeft: 'Du har klarat ',
          of: ' av ',
          words: ' ord ',
          gameNav: '>Navigera till speltyperna i menyn för att lägga till lektioner här.',
          welcomeUser: 'Välkommen, ',
          userStatics: 'Din svarsstatistik:',
          loading: 'Loading...'
        },
        loginScreen: {
          registerTitel: 'Registrera dig snabbt och enkelt här',
          p1:
            ' Vi sparar inga personuppgifter så var noga med att komma ihåg ditt lösenord då vi inte kan återställa det åt dig.',
          p2:
            'Materialet är anpassat efter det svenska språket och du kan lära dig från svenska till japanska och japanska till svenska',
          signUp: 'Logga in eller registrera dig',
          Form: {
            placeholderName: 'Användarnamn',
            placehoolderPassword: 'Lösenord'
          },
          login: {
            login: 'Logga in',
            register: 'Registrera',
            rememberMe: 'Håll mig inloggad'
          }
        },
        logoutScreen: {},
        playScreen: {},
        selectScreen: {
          pageHeader: {
            quiz: 'Quiz',
            guess: 'Gissa ordet',
            translate: 'Översätt ordet',
            flashcards: 'Bildkort',
            kanji: 'Skriv Kanji',
            grammar: 'Böj verb',
            error: 'No play type specified'
          },
          pageDescription: {
            quiz: 'Välj mellan 4 svarsalternativ för den korrekta översättningen.',
            guess: 'Välj mellan 4 svarsalternativ för den korrekta översättningen.',
            translate: 'Översätt det visade ordet i fritext.',
            flashcards:
              'Träna dig själv genom att använda kort, med frågan på ena sidan och rätta svaret på den andra.',
            kanji: 'Försök rita kanji-tecken med korrekta drag och i rätt ordning.',
            grammar: 'Böj det visade ordet i fritext på angiven verbform.',
            error: 'No play type specified'
          },
          getLessons: {
            lessons: 'Lektioner',
            tooltopRed: 'Besvarade frågor som behöver repeteras',
            tooltipBlue: 'Obesvarade frågor',
            toolTipIncor: 'Antal felbesvarade frågor',
            smartLeraning: 'Smart inlärningsläge',
            on: 'På',
            of: 'Av',
            drawEasy: 'Enkelt - Följ en bana',
            drawMeduim: 'Medium - Rita med hjälp',
            drawHard: 'Svårt - Rita på frihand',
            panel: {
              mixedQuestion: 'Blandade frågor ',
              mixedFavLession: 'Blandade frågor från alla dina favoritmarkerade lektioner.',
              wrongQuestion: 'Felbesvarade frågor ',
              failedQuestions: 'Här hamnar alla frågor som du har svarat fel på.'
            },
            displayLessions: {
              lessonFav: 'Pågående lektioner',
              lessonFavDone: 'Färdiga lektioner',
              otherLesson: 'Övriga lektioner'
            }
          }
        },
        startScreen: {
          navigation: '',
          header: {
            introductionTitle: 'Bli student och lär dig japanska!'
          },
          jumbotronBanner: {
            colOne: {
              h2: 'Gakusei erbjuder många funktioner som underlättar ditt lärande'
            }
          },
          aboutFeatureImage: {
            colTwo: {
              h3: 'Ett bra komplement till undervisning',
              p: 'Olika sorters övningar, anpassade efter japanska undervisning på högskolenivå.'
            },
            colThree: {
              h3: 'Gakusei överallt'
            },
            colFour: {
              h3: 'Anonymitet',
              p: 'Gakusei lagrar ingen personlig data om sina användare, det enda som behövs är ett användarnamn.'
            },
            colFive: {
              h3: 'quizar',
              p: 'Prova våra quizar och se vad du kan om Japan.'
            },
            colSix: {
              h3: 'Smart inlärningsteknologi',
              p:
                'Vårt system kommer ihåg hur du har svarat på frågor, på så sätt kan vi anpassa inlärningsmaterialet efter dig.'
            }
          },
          jumbotronBannerDaigaku: {
            h2: 'Daigaku Sverige utvecklar Gakusei',
            p:
              'Daigaku Sverige har som mål att främja undervisning i, och forskning om japanska. Idag måste man i stor utsträckning lära sig japanska via engelska. Vi tror att det skulle vara en fördel om åtminstone en del inlärning kan ske direkt från svenska till japanska. Därför har vi skapat Gakusei, den första webbapplikationen som lär dig japanska via svenska!'
          },
          jumbotronRegister: {
            h2: 'Utöka din kunskap med Gakusei!'
          }
        },
        appScreen: {
          copyrightText: '© Gakusei 2018 - Alla rättigheter reserverade.'
        },

        numbers: {
          zero: '0',
          one: '1',
          two: '2',
          three: '3',
          four: '4',
          five: '5',
          six: '6',
          seven: '7',
          eight: '8',
          nine: '9'
        },
        button: {
          readMore: 'Läs mer',
          tryNow: 'Testa redan nu!',
          register: 'Registrera dig nu!'
        }
      }
    },

    jp: {
      translations: {
        aboutScreen: {
          aboutGakusei: {
            h2: '学生について',
            p:
              ' \n' +
              '学生は、日本語で練習できるWebアプリケーションです。アプリケーションには、次の4つのゲームモードがあります。',
            li1:
              '&quot;Gissa ordet&quot; som kan hittas under fliken &quot;Glosor&quot;. Här ska man välja rätt översättning på ett ord bland fyra alternativ.',
            li2:
              '&quot;Bildkort&quot; som även det kan hittas under fliken &quot;Glosor&quot;. Här gäller det att gissa rätt på ett ord. Gissade du rätt?',
            li3: '&quot;Quiz&quot; och här kan du spela frågesporter kopplade till Japan.',
            li4: '&quot;Kanji&quot; och här kan du testa dina kunskaper i kanji.'
          },
          rights: {
            h4: '権利',
            p: '協力して開発',
            link: 'KITS AB',
            p2:
              '. プログラムコードのすべての権利は、Kokitotsos ABによって所有されています。 このサイトは、スウェーデン大学図書館が運営しています。スウェーデンは、Kokitotsos ABによる学生のライセンスをオープンソースライセンスで提供しています。 教育資料は、Pierre Sandbogeによって編集されており、このページの他の場所に示されている自分自身の資料やその他の資料が含まれています。',
            link2: 'Daigaku.se',
            p3:
              '従業員なしで運営され、寄付された資金で運営され、可用性の保証はありません。 サービスの提供は、通知なしにいつでも終了することができます。'
          },
          licenses: {
            licens: 'ライセンス',
            modul: 'モジュール',
            version: 'バージョン：',
            repo: 'リポジトリ：',
            licenses: 'ライセンス',
            p: '学生用アプリはライセンス契約に基づいています',
            link: 'MIT',
            p2: '. 以下は、プロジェクトが使用するモジュールのライセンス一覧です。',
            panelToggle: 'その他のライセンスはここをクリック'
          },
          infoBanner: {
            contributors: {
              contributors: '協力者',
              p3: '誰がプロジェクトに貢献したかを見る',
              link2: 'ここに'
            },
            github: {
              github: 'ギブス',
              p: 'オープンソースプロジェクトをご覧ください',
              link: 'ページ。'
            },
            owner: {
              owner: '所有権',
              p: 'プログラムコードのすべての権利は、Kokitotsos ABによって所有されています。'
            }
          }
        },
        finishScreen: {
          correct: '％右！',
          rightAnswer: ' あなたは正しく答えた ',
          witch: 'の ',
          sumQuestion: ' 可能な質問',
          tryAgain: 'もう一度お試しください',
          button: '新しい質問を選択'
        },
        grammarScreen: {},
        homeScreen: {
          rightAnswer: '正しい答えを共有してください！',
          wrongAnswer: '間違った答えを共有する',
          favLesson: 'お気に入りのレッスン',
          progressbar: 'クリアされた％',
          quiestionLeft: 'あなたはそれをやった ',
          of: ' の ',
          words: ' 単語 ',
          gameNav: 'メニューのゲームタイプに移動してレッスンを追加します。',
          welcomeUser: 'ようこそ、 ',
          userStatics: 'あなたの応答の統計：',
          loading: '充填...'
        },
        loginScreen: {
          registerTitel: 'ここにすばやく簡単に登録する',
          p1: '私たちは個人情報を保存しませんので、パスワードを覚えておいてください。',
          p2: 'この資料はスウェーデン語に適合しており、スウェーデン語から日本語、スウェーデン語',
          signUp: 'ログインまたは登録',
          Form: {
            placeholderName: 'ユーザー名',
            placehoolderPassword: 'パスワード'
          },
          login: {
            login: 'ログイン',
            register: 'サインアップ',
            rememberMe: '私をログインさせておく'
          }
        },
        logoutScreen: {},
        playScreen: {},
        selectScreen: {
          pageHeader: {
            quiz: '考査',
            guess: '単語を推測する',
            translate: '言葉を翻訳する',
            flashcards: 'フォトカード',
            kanji: 'タイプ漢字',
            grammar: '曲げ動詞',
            error: 'No play type specified'
          },
          pageDescription: {
            quiz: 'Välj mellan 4 svarsalternativ för den korrekta översättningen.',
            guess: 'Välj mellan 4 svarsalternativ för den korrekta översättningen.',
            translate: 'Översätt det visade ordet i fritext.',
            flashcards:
              'Träna dig själv genom att använda kort, med frågan på ena sidan och rätta svaret på den andra.',
            kanji: 'Försök rita kanji-tecken med korrekta drag och i rätt ordning.',
            grammar: 'Böj det visade ordet i fritext på angiven verbform.',
            error: 'No play type specified'
          },
          getLessons: {
            lessons: 'Lektioner',
            tooltopRed: 'Besvarade frågor som behöver repeteras',
            tooltipBlue: 'Obesvarade frågor',
            toolTipIncor: 'Antal felbesvarade frågor',
            smartLeraning: 'Smart inlärningsläge',
            on: 'På',
            of: 'Av',
            drawEasy: 'Enkelt - Följ en bana',
            drawMeduim: 'Medium - Rita med hjälp',
            drawHard: 'Svårt - Rita på frihand',
            panel: {
              mixedQuestion: 'Blandade frågor ',
              mixedFavLession: 'Blandade frågor från alla dina favoritmarkerade lektioner.',
              wrongQuestion: 'Felbesvarade frågor ',
              failedQuestions: 'Här hamnar alla frågor som du har svarat fel på.'
            },
            displayLessions: {
              lessonFav: 'Pågående lektioner',
              lessonFavDone: 'Färdiga lektioner',
              otherLesson: 'Övriga lektioner'
            }
          }
        },
        startScreen: {
          navigation: '',
          header: {
            introductionTitle: 'Bli student och lär dig japanska!'
          },
          jumbotronBanner: {
            colOne: {
              h2: 'Gakusei erbjuder många funktioner som underlättar ditt lärande'
            }
          },
          aboutFeatureImage: {
            colTwo: {
              h3: 'Ett bra komplement till undervisning',
              p: 'Olika sorters övningar, anpassade efter japanska undervisning på högskolenivå.'
            },
            colThree: {
              h3: 'Gakusei överallt'
            },
            colFour: {
              h3: 'Anonymitet',
              p: 'Gakusei lagrar ingen personlig data om sina användare, det enda som behövs är ett användarnamn.'
            },
            colFive: {
              h3: 'quizar',
              p: 'Prova våra quizar och se vad du kan om Japan.'
            },
            colSix: {
              h3: 'Smart inlärningsteknologi',
              p:
                'Vårt system kommer ihåg hur du har svarat på frågor, på så sätt kan vi anpassa inlärningsmaterialet efter dig.'
            }
          },
          jumbotronBannerDaigaku: {
            h2: 'Daigaku Sverige utvecklar Gakusei',
            p:
              'Daigaku Sverige har som mål att främja undervisning i, och forskning om japanska. Idag måste man i stor utsträckning lära sig japanska via engelska. Vi tror att det skulle vara en fördel om åtminstone en del inlärning kan ske direkt från svenska till japanska. Därför har vi skapat Gakusei, den första webbapplikationen som lär dig japanska via svenska!'
          },
          jumbotronRegister: {
            h2: 'Utöka din kunskap med Gakusei!'
          }
        },
        appScreen: {
          copyrightText: '© Gakusei 2018 - Alla rättigheter reserverade.'
        },
        numbers: {
          zero: '0',
          one: '1',
          two: '2',
          three: '3',
          four: '4',
          five: '5',
          six: '6',
          seven: '7',
          eight: '8',
          nine: '9'
        },
        button: {
          readMore: 'Läs mer',
          tryNow: 'Testa redan nu!',
          register: 'Registrera dig nu!'
        }
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
