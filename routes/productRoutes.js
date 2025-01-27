const express = require("express");
const router = express.Router();
const db = require("../db");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { error } = require("console");

const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|gif/;
    const extname = fileTypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error("Sadece bu formatlarda (JPEG,PNG,JPG,GIF)"));
    }
  },
});

// Tüm ürünler
router.get("/", async (req, res) => {
  try {
    const [results] = await db.query("SELECT * FROM urunler");
    res.json(results);
  } catch (err) {
    console.error("Ürünleri getirirken hata oluştu:", err);
    res
      .status(500)
      .json({ error: "Ürünleri veritabanından getirirken hata oluştu" });
  }
});
// GET ID'ye göre
router.get("/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.query("SELECT * FROM urunler WHERE id = ?", [
      id,
    ]);

    if (result.length === 0) {
      return res.status(404).json({ error: "Ürün bulunamadı" });
    }
    res.json(result[0]);
  } catch (err) {
    console.error("Ürünleri getirirken hata oluştu:", err);
    res
      .status(500)
      .json({ error: "Ürünleri veritabanından getirirken hata oluştu" });
  }
});

// POST görselleri ile birlikte ürün ekleme
router.post("/", upload.array("gorsel", 5), async (req, res) => {
  const { isim, aciklama, fiyat, miktar } = req.body;
  const gorsel = req.files.map((file) => `/uploads/${file.filename}`);

  try {
    const [result] = await db.query(
      "INSERT INTO urunler (isim,aciklama,fiyat,gorsel,miktar) VALUES (?,?,?,?,?)",
      [isim, aciklama, fiyat, JSON.stringify(gorsel), miktar]
    );
    res.json({ id: result.insertId });
  } catch (err) {
    req.files.forEach((file) => {
      fs.unlink(`/uploads/${file.filename}`, (unlinkErr) => {
        if (unlinkErr) console.error("dosya silinemedi:", unlinkErr);
      });
    });

    console.error("Veritabanı sorgusu başarısız:", err);
    res
      .status(500)
      .json({ error: "Ürün kaydedilemedi" });
  }
});
// PATCH update product
router.patch("/:id", upload.array("gorsel", 5), async (req, res) => {
  const { id } = req.params;
  const { isim, aciklama, fiyat, miktar } = req.body;
  let gorsel;

  try {
    const [fetchResult] = await db.query(
      "SELECT * FROM urunler WHERE id = ?",
      [id]
    );

    if (fetchResult.length === 0) {
      return res.status(400).json({ error: "Ürün bulunamadı" });
    }
    const currentProduct = fetchResult[0];
    const currentImages = JSON.parse(currentProduct.images); // Mevcut görseller

    if (req.files.length > 0) {
      gorsel = req.files.map((file) => `/uploads/${file.filename}`);

      // Eski görselleri silme
      currentImages.forEach((imagePath) => {
        const imageFilePath = path.join(__dirname, "..", imagePath);
        fs.unlink(imageFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error(
              "Eski görsel silinemedi:",
              imageFilePath,
              unlinkErr
            );
          } else {
            console.log("Eski görseli sil:", imageFilePath);
          }
        });
      });
    } else {
      gorsel = currentImages; 
    }

    const updatedProduct = {
      isim: isim || currentProduct.isim,
      aciklama: aciklama || currentProduct.aciklama,
      fiyat: fiyat|| currentProduct.fiyat,
      miktar: miktar || currentProduct.miktar,
      gorsel: JSON.stringify(gorsel),
    };

    await db.query(
      "UPDATE urunler SET isim = ?, aciklama = ?, fiyat = ?, miktar = ? , gorsel = ? WHERE id = ?",
      [
        updatedProduct.isim,
        updatedProduct.aciklama,
        updatedProduct.fiyat,
        updatedProduct.miktar,
        updatedProduct.gorsel,
        id,
      ]
    );

    res.json({ message: "Ürün başarıyla güncellendi" });
  } catch (err) {
    console.error("Veritabanı sorgusu başarısız:", err);

    if (req.files.length > 0) {
      req.files.forEach((file) => {
        const imageFilePath = path.join(
          __dirname,
          "..",
          "uploads",
          file.filename
        );

        fs.unlink(imageFilePath, (unlinkErr) => {
          if (unlinkErr)
            console.error("Yüklenen dosya silinemedi:", unlinkErr);
        });
      });
    }

    res
      .status(500)
      .json({ error: "Ürün güncellenemedi" });
  }
});

router.delete("/:id", upload.array("gorsel", 5), async (req, res) => {
  const { id } = req.params;

  try {
    const [fetchResult] = await db.query(
      "SELECT * FROM urunler WHERE id = ?",
      [id]
    );

    if (fetchResult.length === 0) {
      return res.status(400).json({ error: "Ürün bulunamadı" });
    }
    let gorsel = fetchResult[0].gorsel;

    try {
      gorsel = JSON.parse(gorsel);
    } catch (err) {
      console.error("Görselleri ayrıştırma başarısız oldu", err);
      return res.status(500).json({ error: "Görselleri ayrıştırma başarısız oldu" });
    }

    if (Array.isArray(gorsel)) {
      gorsel.forEach((imagePath) => {
        const imageFilePath = path.join(__dirname, "..", imagePath);
        fs.unlink(imageFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error("Görsel silinemedi:", imageFilePath, unlinkErr);
          }
        });
      });
    }

    await db.query("DELETE FROM urunler WHERE id = ?", [id]);
    res.json({ message: "Ürün ve görselleri başarıyla silindi" });
  } catch (err) {
    console.error("Veritabanı sorgusu hatası:", err);
    res.status(500).json({ error: "Ürün silinemedi" });
  }
});

module.exports = router;
