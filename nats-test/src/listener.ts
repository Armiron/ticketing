import nats, { Message, Stan } from 'node-nats-streaming';
import { randomBytes } from 'crypto';
import { TicketCreatedListener } from './events/ticket-created-listener';
console.clear();

const stan = nats.connect('ticketing', randomBytes(4).toString('hex'), {
  url: 'http://localhost:4222',
});

stan.on('connect', () => {
  console.log('Listener connected to NATS!!');

  stan.on('close', () => {
    console.log('NATS connection closed!');
    process.exit();
  });

  // const options = stan
  //   .subscriptionOptions()
  //   .setManualAckMode(true)
  //   .setDeliverAllAvailable() //Still needed with durable name
  //   .setDurableName('orders-service'); //Tell Nats that we did stuff and we aknowledge
  //Durable name are recorded in nats and nats knows what events were aknowledged by the durable name
  //Delivers all the events //but too many after some time
  // const subscription = stan.subscribe(
  //   'ticket:created',
  //   'queue-group-name', //Need it cause it dumps the durable name
  //   options
  // );
  // subscription.on('message', (msg: Message) => {
  //   console.log('Message Received');
  //   const data = msg.getData();

  //   if (typeof data === 'string') {
  //     console.log(`Received Event #${msg.getSequence()}, with data: ${data}`);
  //   }

  //   msg.ack();
  //   //console.log(msg.getData());
  // });

  new TicketCreatedListener(stan).listen();
});

process.on('SIGINT', () => {
  stan.close();
});
process.on('SIGTERM', () => {
  stan.close();
});
