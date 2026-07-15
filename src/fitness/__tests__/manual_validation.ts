import supertest from 'supertest';
import { buildApp } from '../../app';
import prisma from '../../lib/prisma';
import { randomUUID } from 'crypto';

async function main() {
  const app = await buildApp();
  await app.ready();
  await prisma.$connect();

  console.log('--- Creating personal trainer ---');
  const regPersonalRes = await supertest(app.server)
    .post('/api/auth/register')
    .send({ email: 'manual_personal@thunderafit.test', password: 'SenhaSegura@123', role: 'PERSONAL' });
  const personalId = regPersonalRes.body.user.id;
  console.log('Personal created:', JSON.stringify(regPersonalRes.body.user));

  console.log('--- Creating 4 students ---');
  const studentIds = [];
  for (let i = 1; i <= 4; i++) {
    const res = await supertest(app.server)
      .post('/api/auth/register')
      .send({ email: `manual_student${i}@thunderafit.test`, password: 'SenhaSegura@123', role: 'ALUNO' });
    studentIds.push(res.body.user.id);
    console.log(`Student ${i} created:`, res.body.user.id);
  }

  console.log('--- Logging in personal ---');
  const loginRes = await supertest(app.server)
    .post('/api/auth/login')
    .send({ email: 'manual_personal@thunderafit.test', password: 'SenhaSegura@123' });
  const token = loginRes.body.accessToken;
  console.log('Token:', token);

  const headers = { Authorization: `Bearer ${token}` };

  const rel1 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[0] });
  console.log(`POST /api/relations 1st: status ${rel1.status}`, JSON.stringify(rel1.body));

  const rel2 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[1] });
  console.log(`POST /api/relations 2nd: status ${rel2.status}`, JSON.stringify(rel2.body));

  const rel3 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[2] });
  console.log(`POST /api/relations 3rd: status ${rel3.status}`, JSON.stringify(rel3.body));

  const rel4 = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[3] });
  console.log(`POST /api/relations 4th: status ${rel4.status}`, JSON.stringify(rel4.body));

  const dup = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: studentIds[0] });
  console.log(`POST /api/relations duplicate: status ${dup.status}`, JSON.stringify(dup.body));

  const randomId = randomUUID();
  const nonexistent = await supertest(app.server)
    .post('/api/relations')
    .set(headers)
    .send({ alunoId: randomId });
  console.log(`POST /api/relations nonexistent: status ${nonexistent.status}`, JSON.stringify(nonexistent.body));

  const getList = await supertest(app.server)
    .get('/api/relations')
    .set(headers);
  console.log(`GET /api/relations: status ${getList.status}`, JSON.stringify(getList.body));

  await prisma.$disconnect();
  await app.close();
}

main();
