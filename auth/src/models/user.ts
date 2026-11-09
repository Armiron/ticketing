import mongoose from 'mongoose';
import Password from '../services/password.ts';

// An interface that describes the properties
// that are required to create a user
interface UserAttrs {
  email: string;
  password: string;
}

// An interface that describes the properties
// that a User Model has
interface UserModel extends mongoose.Model<UserDocument> {
  build(attrs: UserAttrs): UserDocument;
}

// An interface that describes the properties
// that a User Document has
// cause we can tell mongoose to add new ones behind the scenes
// and we can add them in this interface and make everything clear
interface UserDocument extends mongoose.Document {
  email: string;
  password: string;
  // Mongoose's built-in `id` virtual (string form of _id)
  id: string;
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      // Enforce uniqueness at the DB level too — the findOne check in the
      // route has a race window on concurrent signups, this closes it.
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
  },
  {
    toJSON: {
      //Direct changes to that object
      transform(doc, ret) {
        // Mongoose 9 types `ret` strictly, so copy to a loose record before
        // mutating the keys.
        const output = { ...ret } as Record<string, unknown>;
        output.id = output._id;
        delete output.password; //Remove keyword NORMAL JS i didnt know
        delete output.__v; //versionKey booleanto kinda do the same
        delete output._id;
        return output;
      },
    },
  }
);

// Mongoose 9 middleware: an async function is supported directly, so no
// `done` callback is needed (passing one was a leftover from old API).
userSchema.pre('save', async function () {
  // this is the actual use thats being saved so we need it
  // When we modify a user document it will always run this function and
  // we don't need to hash always the password unless is changed
  if (this.isModified('password')) {
    const hashedPassword = await Password.toHash(this.get('password'));
    this.set('password', hashedPassword);
  }
});

userSchema.statics.build = (attrs: UserAttrs) => {
  return new User(attrs);
};

//const User = mongoose.model('User', userSchema);

// To help us with TypeScript stuff
// const buildUser = (attrs: UserAttrs) => {
//   return new User(attrs);
// };

//export { User, buildUser };

const User = mongoose.model<UserDocument, UserModel>('User', userSchema);
// All that to add User.build() when we create another user
// Added User Document so that we know what user is properly
// const user = User.build({
//   email: 'ciao',
//   password: 'ciao',
// });

export default User;
