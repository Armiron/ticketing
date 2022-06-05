import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../app';
import { Order } from '../../models/order';
import { Ticket } from '../../models/ticket';

const buildTicket = async () => {
  const ticket = Ticket.build({
    id: new mongoose.Types.ObjectId().toHexString(),
    title: 'Title',
    price: 1,
  });

  await ticket.save();

  return ticket;
};

it('fetches orders for a particular user', async () => {
  // Create three tickets
  const ticketOne = await buildTicket();
  const ticketTwo = await buildTicket();
  const ticketThree = await buildTicket();

  const userOne = signin();
  const userTwo = signin();
  // Create one order as User 1
  await request(app)
    .post('/api/orders')
    .set(userOne)
    .send({ ticketId: ticketOne.id })
    .expect(201);

  // Create three orders as User 2
  // Destructure and rename
  const { body: orderOne } = await request(app)
    .post('/api/orders')
    .set(userTwo)
    .send({ ticketId: ticketTwo.id })
    .expect(201);

  const { body: orderTwo } = await request(app)
    .post('/api/orders')
    .set(userTwo)
    .send({ ticketId: ticketThree.id })
    .expect(201);

  // Make request to get orders for User 2
  const response = await request(app)
    .get('/api/orders')
    .set(userTwo)
    .expect(200);

  // Make sure we only get the orders for User 2
  expect(response.body.length).toEqual(2);
  expect(response.body[0].id).toEqual(orderOne.id);
  expect(response.body[1].id).toEqual(orderTwo.id);
  expect(response.body[0].ticket.id).toEqual(ticketTwo.id);
  expect(response.body[1].ticket.id).toEqual(ticketThree.id);
});
