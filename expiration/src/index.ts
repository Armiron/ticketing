import { natsWrapper } from './nats-wrapper';
import { OrderCreatedListener } from './event/listeners/order-created-listener';

const start = async () => {
  if (!process.env.NATS_CLIENT_ID) {
    throw new Error('NATS_CLIENT_ID not specified');
  }

  if (!process.env.NATS_URL) {
    throw new Error('NATS_URL not specified');
  }

  if (!process.env.NATS_CLUSTER_ID) {
    throw new Error('NATS_CLUSTER_ID not specified');
  }

  try {
    //cluster id is specified in depl cid argument
    // await natsWrapper.connect('ticketing', 'rand', 'http://nats-srv:4222');
    await natsWrapper.connect(
      process.env.NATS_CLUSTER_ID,
      process.env.NATS_CLIENT_ID,
      process.env.NATS_URL
    );
    natsWrapper.client.on('close', () => {
      console.log('NATS connection closed!!!');
      process.exit();
    });
    process.on('SIGINT', () => natsWrapper.client.close());
    process.on('SIGTERM', () => natsWrapper.client.close());

    new OrderCreatedListener(natsWrapper.client).listen();
  } catch (err) {
    console.log(err);
  }
};

start();
