import { Stan } from 'node-nats-streaming';
import { Subjects } from './Subjects';

interface Event {
  subject: Subjects;
  data: any;
}

// Generics enforce type checking when creating a Publisher subclass.
export abstract class Publisher<T extends Event> {
  abstract subject: T['subject'];

  protected client: Stan;

  constructor(client: Stan) {
    this.client = client;
  }

  publish(event: T['data']): Promise<void> {
    return new Promise((resolve, reject) => {
      this.client.publish(this.subject, JSON.stringify(event), (err) => {
        if (err) {
          return reject(err);
        }
        console.log(
          `Event published successfully to subject ${this.subject}`
        );
        resolve();
      });
    });
  }
}
