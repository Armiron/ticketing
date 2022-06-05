import request from 'supertest';
import { app } from '../../app';

it('responds with details about the current user', async () => {
  const authResponse = await request(app)
    .post('/api/users/signup')
    .send({
      email: 'test@test.com',
      password: 'password',
    })
    .expect(201);

  const setCookie = authResponse.get('Set-Cookie')[0];
  const cookie = setCookie.split(';')[0];

  const response = await request(app)
    .get('api/users/currentUser')
    .set('Cookie', setCookie)
    .send()
    .expect(200);

  expect(response.body.currentUser.email).toEqual('test@test.com');
});
