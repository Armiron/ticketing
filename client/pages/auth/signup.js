import { useState } from 'react';
import axios from 'axios';
import useRequest from '../../hooks/use-request';
import Router from 'next/router';

export default () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { doRequest, errors } = useRequest({
    url: '/api/users/signup',
    method: 'post',
    body: {
      email,
      password,
    },
    onSuccess: () => Router.push('/'),
  });
  //const [errors, setErrors] = useState([]);

  const onSubmit = async (event) => {
    event.preventDefault();

    //Error is caught so it proceeds
    await doRequest();

    //added in callback
    //Router.push('/');
    //console.log(email, password);

    //Done in the custom Hook
    // try {
    //   const response = await axios.post('/api/users/signup', {
    //     email,
    //     password,
    //   });
    //   console.log(response.data);
    // } catch (err) {
    //   setErrors(err.response.data.errors);
    // }
  };

  return (
    <form onSubmit={onSubmit}>
      <h1>Sign Up</h1>
      <div className="form-group">
        <label>Email Address:</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="form-control"
        />
      </div>
      <div className="form-group">
        <label>Password:</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          className="form-control"
        />
      </div>
      {errors}
      {/* {errors.length > 0 && (
        <div className="alert alert-danger">
          <h4>Ooops</h4>
          <ul className="my-0">
            {errors.map((err) => (
              <li key={err.message}> {err.message} </li>
            ))}
          </ul>
        </div>
      )} */}
      <button className="btn btn-primary">Sign Up</button>
    </form>
  );
};
