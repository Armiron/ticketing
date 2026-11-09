import express from 'express';
const router = express.Router();

router.post('/api/users/signout', (req, res) => {
  try {
    req.session = null;
    res.status(200).send({ message: 'Successfully signed out' });
  } catch (error) {
    res.status(500).send({ error: 'Failed to sign out' });
  }
});

export { router as signoutRouter };
