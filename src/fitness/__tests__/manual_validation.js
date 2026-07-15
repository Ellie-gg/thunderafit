const supertest = require('supertest');
const { buildApp } = require('../../app');
const prisma = require('../../lib/prisma');
const { v4: uuidv4 } = require('uuid');

(async () => {
  const app = await buildApp();
  await app.ready();
  await prisma.$connect();

  console.log("--- Creating personal trainer ---");
  const regPersonalRes = await supertest(app.server)
    .post('/api/auth/register')
    .send({ email: 'manual_personal@thunderafit.test', password: 'SenhaSegura@123', role: 'PERSONAL' });
  const personalId = regPersonalRes.body.user.id;
  console.log('Personal created:', JSON.stringify(regPersonalRes.body.user));

  console.log("--- Creating 4 students ---");
  const studentIds = [];
  for (let i = 1; i <= 4; i++) {
    const res = await supertest(app.server)
      .post('/api/auth/register')
      .send({ email: `manual_student${i}@thunderafit.test`, password: 'SenhaSegura@123', role: 'ALUNO' });
    studentIds.push(res.body.user.id);
    console.log(`Student ${i} created:`, res.body.user.id);
  }

  console.log("--- Logging in personal ---");
  const loginRes = await supertest(app.server)
    .post('/api/auth/login')
    .send({ email: 'manual_personal@thunderafit.test', password: 'SenhaSegura@123' });
  const token = loginRes.body.accessToken;
  console.log('Token:', token);

  const headers = { Authorization: `Bearer ${token}` };

  // 1st link student1
  const rel1 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[0] });
  console.log('POST /api/relations 1st: status', rel1.status, 'body', JSON.stringify(rel1.body));

  // 2nd link student2
  const rel2 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[1] });
  console.log('POST /api/relations 2nd: status', rel2.status, 'body', JSON.stringify(rel2.body));

  // 3rd link student3
  const rel3 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[2] });
  console.log('POST /api/relations 3rd: status', rel3.status, 'body', JSON.stringify(rel3.body));

  // 4th link student4 -> should be 403 limit reached
  const rel4 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[3] });
  console.log('POST /api/relations 4th: status', rel4.status, 'body', JSON.stringify(rel4.body));

  // duplicate link student1 again -> 409
  const dup = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[0] });
  console.log('POST /api/relations duplicate: status', dup.status, 'body', JSON.stringify(dup.body));

  // nonexistent student -> 404
  const randomId = uuidv4();
  const nonexistent = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: randomId });
  console.log('POST /api/relations nonexistent: status', nonexistent.status, 'body', JSON.stringify(nonexistent.body));

  // GET list
  const getList = await supertest(app.server)
    .get('/api/relations')
    .set(headers);
  console.log('GET /api/relations: status', getList.status, 'body', JSON.stringify(getList.body));

  await prisma.$disconnect();
  await app.close();
})();
