import * as request from 'supertest';
import { app } from '../../app';

it('returns a 201 on successfull singup', async () => {
  return request(app)
    .post('/api/users/signup')
    .send({
      email: 'test@test.com',
      password: 'password',
    })
    .expect(201);
});

it('returns a 400 with invalid email', async () => {
  return request(app)
    .post('/api/users/signup')
    .send({
      email: 'wrong.email',
      password: 'password',
    })
    .expect(400);
});

it('returns a 400 with invalid password', async () => {
  return request(app)
    .post('/api/users/signup')
    .send({
      email: 'test@test.com',
      password: 'no',
    })
    .expect(400);
});

it('returns a 400 with no email and password', async () => {
  return request(app).post('/api/users/signup').send({}).expect(400);
});

it('disallows duplicate emails', async () => {
  await request(app)
    .post('/api/users/signup')
    .send({
      email: 'test1@test.com',
      password: 'password',
    })
    .expect(201);

  return request(app)
    .post('/api/users/signup')
    .send({
      email: 'test1@test.com',
      password: 'password',
    })
    .expect(400);
});

it('sets a cookie after successfull signup', async () => {
  const response = await request(app)
    .post('/api/users/signup')
    .send({
      email: 'test1@test.com',
      password: 'password',
    })
    .expect(201);

  expect(response.get('Set-Cookie')).toBeDefined();
});
