import 'dotenv/config';
import { app } from './app';

const port = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(port, () => {
  console.log(`Escrow API listening on http://localhost:${port}`);
});
