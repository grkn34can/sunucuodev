const express = require("express");
const cors = require("cors");
require("dotenv").config();
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// Routelar
app.use("/api/urunler/", require("./routes/productRoutes"));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Sunucu kurulumu
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu portu ${PORT}`);
});
