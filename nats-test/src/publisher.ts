import nats from 'node-nats-streaming';
import { TicketCreatedPublisher } from './events/ticket-created-publisher';

console.clear();

const /*client*/ stan = nats.connect('ticketing', 'abc', {
    url: 'http://localhost:4222',
  });

stan.on('connect', async () => {
  console.log('Publisher connected to NATS!!');

  const publisher = new TicketCreatedPublisher(stan);
  //Transformed publish in the class as a promise so we can await it
  try {
    await publisher.publish({
      id: '1234',
      title: 'Concert',
      price: 20,
    });
  } catch (error) {
    console.error(error);
  }
  //Before TS stuff
  // const data = JSON.stringify({
  //   id: '1234',
  //   title: 'concert',
  //   price: 20,
  // });

  // stan.publish('ticket:created', data, () => {
  //   console.log('Event Published!!');
  // });
});
