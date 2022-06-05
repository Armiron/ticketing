import request from 'supertest';
import { app } from '../../app';
import mongoose from 'mongoose';

it('returns a 400 with random id', async () => {
  await request(app).get('/api/tickets/fakeID').send().expect(400);
});

it('returns a 404 if the ticket in not found', async () => {
  const id = new mongoose.Types.ObjectId().toHexString();
  await request(app).get(`/api/tickets/${id}`).send().expect(404);
});

it('returns the ticket if the ticket is found', async () => {
  const title = 'Title';
  const price = 1;
  const response = await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({
      title,
      price,
    })
    .expect(201);

  const ticketResponse = await request(app)
    .get(`/api/tickets/${response.body.id}`)
    .send()
    .expect(200);

  expect(ticketResponse.body.title).toEqual(title);
  expect(ticketResponse.body.price).toEqual(price);
});
