import mongoose from 'mongoose';
import request from 'supertest';
import { app } from '../../app';
import { Ticket } from '../../models/ticket';
import { Order, OrderStatus } from '../../models/order';
import { natsWrapper } from '../../nats-wrapper';

it('marks an order as cancelled', async () => {
  // Create a ticket with ticket model
  const ticket = Ticket.build({
    id: new mongoose.Types.ObjectId().toHexString(),
    title: 'title',
    price: 1,
  });
  await ticket.save();

  const user = signin();
  // make a req to create an order
  const { body: order } = await request(app)
    .post('/api/orders')
    .set(user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // make a req to cancel the order
  await request(app)
    .delete(`/api/orders/${order.id}`)
    .set(user)
    .send()
    .expect(204);

  // expectation to make sure the thing is cancelled
  const updatedOrder = await Order.findById(order.id);
  expect(updatedOrder!.status).toEqual(OrderStatus.Cancelled);
});

it('emits a order cancelled event', async () => {
  const ticket = Ticket.build({
    id: new mongoose.Types.ObjectId().toHexString(),
    title: 'title',
    price: 1,
  });
  await ticket.save();

  const user = signin();
  // make a req to create an order
  const { body: order } = await request(app)
    .post('/api/orders')
    .set(user)
    .send({ ticketId: ticket.id })
    .expect(201);

  // make a req to cancel the order
  await request(app)
    .delete(`/api/orders/${order.id}`)
    .set(user)
    .send()
    .expect(204);

  expect(natsWrapper.client.publish).toHaveBeenCalled();
});
