import { Message } from 'node-nats-streaming';
import { Listener } from './base-listener';
import { Subjects } from './subjects';
import { TicketCreatedEvent } from './ticket-created-event';

//Now it expects to get an argument
export class TicketCreatedListener extends Listener<TicketCreatedEvent> {
  //First add it the type then the value cause TS thinks we might reassign it with like this.attrName
  //If i omit the Type it can be anything inside of the enum Subjects
  subject: Subjects.TicketCreated = Subjects.TicketCreated; //'ticket:created';
  queueGroupName = 'payments-service';
  onMessage(data: TicketCreatedEvent['data'] /*any*/, message: Message) {
    console.log('Event data!', data);
    console.log(data.id);

    message.ack();
  }
}
