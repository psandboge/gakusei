// Synthetic, public test data only. These responses do not verify Spring/SQL.
const lesson = { id: 9001, name: 'Migration P0', description: 'Two deterministic public examples' };
function questions(mode) {
  return [1, 2].map((n) => ({
    questionNuggetId: 9000 + n,
    question: mode === 'kanji' ? [`line ${n}`, '一', `line ${n}`, '一'] : [`P0 question ${n}`],
    correctAlternative: [[mode === 'kanji' ? '一' : `answer ${n}`]],
    alternative1: [`wrong ${n}a`], alternative2: [`wrong ${n}b`], alternative3: [`wrong ${n}c`],
    resourceReference: null
  }));
}
function install(app) {
  app.state.username = 'P0Alice';
  app.state.favorites = [];
  const ok = body => ({ status: 200, body });
  app.respond('GET', '/api/lessons', () => ok([lesson]));
  app.respond('GET', '/api/quizes', () => ok([lesson]));
  app.respond('GET', '/api/lessonInfo', () => ok({ [lesson.name]: { unanswered: 2, retention: 0, all: 2, correctlyAnswered: 0 } }));
  app.respond('GET', '/api/lessons/incorrectcount', () => ok({}));
  app.respond('GET', '/api/lessons/favorite', () => ok([lesson]));
  app.respond('GET', '/api/userLessons', ({state}) => ok(state.favorites.map(name => ({ lesson: { ...lesson, name } }))));
  app.respond('POST', '/api/userLessons/add', ({query,state}) => {state.favorites = [...new Set([...state.favorites, query.lessonName])]; return ok({});});
  app.respond('DELETE', '/api/userLessons/remove', ({query,state}) => {state.favorites = state.favorites.filter(x => x !== query.lessonName); return ok({});});
  for (const path of ['/api/questions', '/api/questions/kanji', '/api/quiz'])
    app.respond('GET', path, ({query}) => ok(questions(query.lessonType)));
  for (const path of ['/api/events', '/api/events2', '/api/kanji-drawings']) app.respond('POST', path, () => ok({}));
  for (const n of [1,2]) app.respond('GET', `/api/quiz/nugget/correctAnswer/answer%20${n}`, () => ok({ quizImage: '/img/kanji/elefant.svg' }));
}
module.exports = { install, lesson, questions };
