import express from "express";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Route: split string into 10 parts
app.post("/split", (req, res) => {
  const input = String(req.body.text || "");
  const N = 10;
  const len = input.length;
  const responseObject = {};
  const chunkSize = Math.ceil(len / N);

  let chunkIndex = 1;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = input.slice(i, i + chunkSize);
    responseObject[`chunk${chunkIndex}`] = chunk;
    chunkIndex++;
  }

  res.json(responseObject);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
