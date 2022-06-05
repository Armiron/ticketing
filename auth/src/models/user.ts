import * as mongoose from 'mongoose';
import Password from '../services/password';

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
}

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
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
        ret.id = ret._id;
        delete ret.password; //Remove keyword NORMAL JS i didnt know
        delete ret.__v; //versionKey booleanto kinda do the same
        delete ret._id;
      },
    },
  }
);

// Uses middleware function so u have to call done when you finish
userSchema.pre('save', async function (done) {
  // this is the actual use thats being saved so we need it
  // When we modify a user document it will always run this function and
  // we don't need to hash always the password unless is changed
  if (this.isModified('password')) {
    const hashedPassword = await Password.toHash(this.get('password'));
    this.set('password', hashedPassword);
  }

  done();
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
