import request from 'supertest';
import { app } from '../../app';
import mongoose from 'mongoose';
import { natsWrapper } from '../../nats-wrapper';
import { Ticket } from '../../models/ticket';

it("returns 404 if provided id doesn't exist", async () => {
  const id = new mongoose.Types.ObjectId().toHexString();
  await request(app)
    .put(`/api/tickets/${id}`)
    .set(signin())
    .send({
      title: 'Title',
      price: 1,
    })
    .expect(404);
});

it('returns 401 if user is not authenticated', async () => {
  const id = new mongoose.Types.ObjectId().toHexString();
  const response = await request(app).put(`/api/tickets/${id}`).send({
    title: 'Title',
    price: 1,
  });
  expect(response.statusCode).toEqual(401);
});

it('returns 401 if user does not own the ticket', async () => {
  const response = await request(app)
    .post('/api/tickets')
    .set(signin())
    .send({ title: 'Title', price: 1 });

  const newResponse = await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set(signin())
    .send({
      title: 'New Title',
      price: 2,
    });

  expect(newResponse.statusCode).toEqual(401);
});

it('returns 400 if the user provides an invalid title or price', async () => {
  const cookie = signin();
  const response = await request(app)
    .post('/api/tickets')
    .set(cookie)
    .send({ title: 'Title', price: 1 });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set(cookie)
    .send({ title: '', price: 1 })
    .expect(400);

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set(cookie)
    .send({ title: 'Title', price: -1 })
    .expect(400);
});

it('updates the ticket provided a valid title and price', async () => {
  const cookie = signin();
  const response = await request(app)
    .post('/api/tickets')
    .set(cookie)
    .send({ title: 'Title', price: 1 });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set(cookie)
    .send({ title: 'New Title', price: 2 })
    .expect(200);

  const ticketResponse = await request(app)
    .get(`/api/tickets/${response.body.id}`)
    .send();

  expect(ticketResponse.body.title).toEqual('New Title');
  expect(ticketResponse.body.price).toEqual(2);
});

it('publishes an event', async () => {
  const cookie = signin();
  const response = await request(app)
    .post('/api/tickets')
    .set(cookie)
    .send({ title: 'Title', price: 1 });

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set(cookie)
    .send({ title: 'New Title', price: 2 })
    .expect(200);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});

it('rejects updates if the ticket is reserved', async () => {
  const cookie = signin();
  const response = await request(app)
    .post('/api/tickets')
    .set(cookie)
    .send({ title: 'Title', price: 1 });

  const ticket = await Ticket.findById(response.body.id);

  // I set an order id to the ticket so it becomes reserved and cannot be edited anymore
  ticket!.set({ orderId: new mongoose.Types.ObjectId().toHexString() });

  await ticket!.save();

  await request(app)
    .put(`/api/tickets/${response.body.id}`)
    .set(cookie)
    .send({ title: 'New Title', price: 2 })
    .expect(400);
});
