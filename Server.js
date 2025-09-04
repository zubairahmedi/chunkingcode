import express from "express";
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));

// Route: split string into 10 parts
app.post("/split", (req, res) => {
  console.log("--- New request to /split ---");
  const input = String(req.body.text || "");
  const N = 10;
  const len = input.length;
  console.log(`Received input string of length: ${len}`);

  const responseObject = {};
  const chunkSize = Math.ceil(len / N);
  console.log(`Calculated chunk size: ${chunkSize}`);

  let chunkIndex = 1;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = input.slice(i, i + chunkSize);
    console.log(`- Creating chunk${chunkIndex} with length: ${chunk.length}`);
    responseObject[`chunk${chunkIndex}`] = chunk;
    chunkIndex++;
  }

  console.log("--- Finished processing. Sending response. ---");
  res.json(responseObject);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
