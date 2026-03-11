require("dotenv").config();
const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());

const path = require('path');

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "cafe_management",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

pool
  .getConnection()
  .then(() => console.log("✅ Database connected successfully."))
  .catch((err) => console.error("❌ Database connection failed:", err.message));

app.use((req, res, next) => {
  console.log(`[${req.method}] มีคนพยายามเข้า URL: ${req.url}`);
  next();
});
// ==========================================
// 📌 1. Cafe API
// ==========================================
app.get("/api/cafes", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Cafe WHERE deleted_at IS NULL",
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/cafes", async (req, res) => {
  try {
    const {
      Cafe_Name,
      Cafe_OpenTime,
      Cafe_CloseTime,
      Cafe_Location,
      Cafe_Rating,
    } = req.body;
    
    const id = uuidv4(); // สร้าง ID ใหม่ตามข้อกำหนด UUID ของโปรเจกต์
    
    // 👈 เพิ่มคอลัมน์ img และดักค่าว่างให้เวลาเปิด-ปิด กัน SQL Error
    await pool.query(
      "INSERT INTO Cafe (Cafe_ID, Cafe_Name, Cafe_OpenTime, Cafe_CloseTime, Cafe_Location, Cafe_Rating, img) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        id,
        Cafe_Name,
        Cafe_OpenTime || "00:00:00",
        Cafe_CloseTime || "00:00:00",
        Cafe_Location,
        Cafe_Rating || "0.0",
        "" //  ใส่ String ว่างเผื่อไว้ให้คอลัมน์รูปภาพ
      ],
    );

    // 👈 เปลี่ยนเป็นส่ง message กลับ เพื่อให้ตรงกับ SimpleResponse ใน Kotlin ของเรา
    res.status(201).json({ success: true, message: "สร้างร้านสำเร็จ" }); 
  } catch (error) {
    // สำคัญมาก! ให้พี่เปิดดูหน้าจอ Terminal (จอสีดำๆ ที่รัน Node.js) มันจะบอกตรงนี้เลยว่าพังเพราะอะไร
    console.error(" Add Cafe Error:", error); 
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/cafes/:id", async (req, res) => {
  try {
    const {
      Cafe_Name,
      Cafe_OpenTime,
      Cafe_CloseTime,
      Cafe_Location,
      Cafe_Rating,
    } = req.body;

    console.log("Received update for Cafe ID:", req.body);
    // ตรวจสอบเบื้องต้น: ถ้าค่าไหนไม่มี ให้ใช้ค่าเดิมหรือค่าว่างเพื่อกัน Error
    const query = `
      UPDATE Cafe 
      SET Cafe_Name = ?, 
          Cafe_OpenTime = ?, 
          Cafe_CloseTime = ?, 
          Cafe_Location = ?, 
          Cafe_Rating = ? 
      WHERE Cafe_ID = ? AND deleted_at IS NULL
    `;

    const [result] = await pool.query(query, [
      Cafe_Name,
      Cafe_OpenTime || "00:00:00", // ถ้าส่งมาว่าง ให้ใส่ 00:00:00 กันพัง
      Cafe_CloseTime || "00:00:00",
      Cafe_Location,
      Cafe_Rating || "0.0",        // Rating ปกติเป็น Decimal/Float ส่ง String เลขไปได้เลย
      req.params.id,
    ]);

    if (result.affectedRows === 0) {
        return res.status(404).json({ success: false, message: "ไม่พบร้านค้าที่ต้องการแก้ไข" });
    }

    res.status(200).json({ success: true, message: "อัปเดตข้อมูลร้านเรียบร้อยแล้ว" });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาด: " + error.message });
  }
});

app.delete("/api/cafes/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Cafe SET deleted_at = CURRENT_TIMESTAMP WHERE Cafe_ID = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📌 2. Category API
// ==========================================
app.get("/api/categories", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Category WHERE deleted_at IS NULL",
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/categories", async (req, res) => {
  try {
    const { category_Name } = req.body;
    const id = uuidv4();
    await pool.query(
      "INSERT INTO Category (category_Id, category_Name) VALUES (?, ?)",
      [id, category_Name],
    );
    res.status(201).json({ success: true, data: { id, category_Name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put("/api/categories/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Category SET category_Name=? WHERE category_Id=? AND deleted_at IS NULL",
      [req.body.category_Name, req.params.id],
    );
    res.status(200).json({ success: true, message: "Updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/categories/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Category SET deleted_at = CURRENT_TIMESTAMP WHERE category_Id = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📌 3. Customer API
// ==========================================

// ⚠️ สำคัญมาก: ต้องแน่ใจว่าคุณมีบรรทัดนี้อยู่ด้านบนๆ ของไฟล์ เพื่อให้ Node อ่าน JSON Body ได้
// app.use(express.json());

app.post("/api/login", async (req, res) => {
  // 1. รับข้อมูลจาก Body (แอนดรอยด์ส่งมาชื่อ username กับ password)
  const { username, password } = req.body;
  console.log("Login attempt with email/username:", username);

  try {
    // 2. ค้นหาในฐานข้อมูล Customer (สมมติว่า username คือ email)
    const [rows] = await pool.query(
      "SELECT * FROM Customer WHERE email = ? AND pwd = ? AND deleted_at IS NULL",
      [username, password],
    );

    // 3. เช็คว่าเจอผู้ใช้ไหม
    if (rows.length > 0) {
      const user = rows[0];

      // Login สำเร็จ
      res.status(200).json({
        success: true,
        message: "Login Success",
        role: user.role || "user",
        // 👈 ส่งข้อมูลทั้งก้อนที่ดึงมาจาก DB
        // Android จะใช้ @SerializedName จับคู่ชื่อคอลัมน์ให้เอง
        data: {
          Customer_Id: user.Customer_Id,
          Customer_Name: user.Customer_Name,
          Customer_Phone: user.Customer_Phone,
          email: user.email,
          role: user.role || "user",
          Customer_ReceiveType: user.Customer_ReceiveType || "Dine-in"
        },
        token: "dummy_token_1234",
      });
    }
  } catch (error) {
    console.error("Database Error:", error);
    res.status(500).json({
      message: error.message,
      role: "",
      token: "",
    });
  }
});

app.get("/api/customers", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Customer WHERE deleted_at IS NULL",
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/customers", async (req, res) => {
  try {
    // 1. รับค่าให้ครบตามที่ Android ส่งมา (และให้ตรงกับฐานข้อมูล)
    const { 
      Customer_Name, 
      Customer_Phone, 
      email, 
      pwd, 
      role, 
      Customer_ReceiveType 
    } = req.body;
    
    // 2. สร้าง ID (จากรูปในฐานข้อมูลเห็นนำหน้าด้วย cust- ผมเลยเติมให้คล้ายๆ กันครับ)
    const id = `cust-${uuidv4()}`; 

    // 3. INSERT ให้ครบทั้ง 7 คอลัมน์
    await pool.query(
      "INSERT INTO Customer ( Customer_Name, Customer_Phone, email, role, Customer_ReceiveType, pwd) VALUES ( ?, ?, ?, ?, ?, ?)",
      [
        // id,
        Customer_Name,
        Customer_Phone,
        email,
        role || "user",             // ถ้าไม่ได้เลือกสิทธิ์ ให้เป็น user ไปก่อน
        Customer_ReceiveType || "Dine-in", // ถ้าไม่ได้เลือก ให้รับที่ร้านเป็นค่าเริ่มต้น
        pwd
      ],
    );

    // 4. ตอบกลับให้ตรงกับ SimpleResponse ที่ฝั่ง Android รอรับ
    res.status(201).json({ success: true, message: "สร้างบัญชีลูกค้าสำเร็จ" });
    
  } catch (error) {
    console.error(" Add Customer Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


app.put("/api/customers/:id", async (req, res) => {
  try {
    // 1. รับค่าให้ครบ 5 ตัวตามที่ Android ส่งมาตอนกด "บันทึก"
    const { 
      Customer_Name, 
      Customer_Phone, 
      email, 
      role, 
      Customer_ReceiveType 
    } = req.body;

    // 2. อัปเดตข้อมูลลงฐานข้อมูล (เรียงลำดับเครื่องหมาย ? ให้ตรงกับ array ด้านล่าง)
    await pool.query(
      `UPDATE Customer 
       SET Customer_Name = ?, 
           Customer_Phone = ?, 
           email = ?, 
           role = ?, 
           Customer_ReceiveType = ? 
       WHERE Customer_Id = ? AND deleted_at IS NULL`,
      [
        Customer_Name, 
        Customer_Phone, 
        email, 
        role, 
        Customer_ReceiveType, 
        req.params.id // ดึง ID มาจาก URL
      ]
    );

    res.status(200).json({ success: true, message: "อัปเดตข้อมูลลูกค้าสำเร็จ" });
  } catch (error) {
    console.error(" Update Customer Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});



app.delete("/api/customers/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Customer SET deleted_at = CURRENT_TIMESTAMP WHERE Customer_Id = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📌 4. Status API
// ==========================================
app.get("/api/statuses", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Status WHERE deleted_at IS NULL",
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/statuses", async (req, res) => {
  try {
    const { Status_Name } = req.body;
    const id = uuidv4();
    await pool.query(
      "INSERT INTO Status (Status_ID, Status_Name) VALUES (?, ?)",
      [id, Status_Name],
    );
    res.status(201).json({ success: true, data: { id, Status_Name } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/statuses/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Status SET deleted_at = CURRENT_TIMESTAMP WHERE Status_ID = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📌 5. Payment API
// ==========================================
app.get("/api/payments", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Payment WHERE deleted_at IS NULL",
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/payments", async (req, res) => {
  try {
    const { Payment_Method, Payment_Status, Payment_Date } = req.body;
    const id = uuidv4();
    await pool.query(
      "INSERT INTO Payment (Payment_Id, Payment_Method, Payment_Status, Payment_Date) VALUES (?, ?, ?, ?)",
      [id, Payment_Method, Payment_Status, Payment_Date || new Date()],
    );
    res.status(201).json({ success: true, data: { id, Payment_Method } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/payments/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Payment SET deleted_at = CURRENT_TIMESTAMP WHERE Payment_Id = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📌 6. Menu API
// ==========================================
app.get("/api/menus", async (req, res) => {
  try {
    const [rows] = await pool.query(`
            SELECT m.*, c.category_Name, f.Cafe_Name 
            FROM Menu m 
            LEFT JOIN Category c ON m.category_category_Id = c.category_Id 
            LEFT JOIN Cafe f ON m.Cafe_Cafe_ID = f.Cafe_ID 
            WHERE m.deleted_at IS NULL
        `);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get("/api/cafes/:id/menus", async (req, res) => {
  try {
    const cafeId = req.params.id;
    const [rows] = await pool.query(
      `
            SELECT m.*, c.category_Name, f.Cafe_Name 
            FROM Menu m 
            LEFT JOIN Category c ON m.category_category_Id = c.category_Id 
            LEFT JOIN Cafe f ON m.Cafe_Cafe_ID = f.Cafe_ID 
            WHERE m.Cafe_Cafe_ID = ? AND m.deleted_at IS NULL
        `,
      [cafeId]
    );

    // แม้จะไม่มีเมนู ก็ตอบกลับเป็น array ว่างไป เพื่อไม่ให้แอปฝั่งแอนดรอยด์ Error
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error("Fetch Menus Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


app.post("/api/menus", async (req, res) => {
  try {
    // 1. รับค่าให้ตรงกับ Key ที่ส่งมาจาก Android (mapOf ใน Kotlin)
    const {
      Menu_Name,
      Menu_Price,
      Cafe_ID, // 👈 แอนดรอยด์ส่งตัวนี้มา
      category_category_Id,
      Category_Image,
    } = req.body;

    const id = uuidv4();

    await pool.query(
      "INSERT INTO Menu (Menu_Id, Menu_Name, Menu_Price, Category_Image, Cafe_Cafe_ID, category_category_Id) VALUES (?, ?, ?, ?, ?, ?)",
      [
        id,
        Menu_Name,
        Menu_Price,
        Category_Image || null,        
        Cafe_ID,                       
        category_category_Id || null   
      ],
    );

    res.status(201).json({ success: true, message: "เพิ่มเมนูสำเร็จ" });
  } catch (error) {
    console.error("Add Menu Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


app.put("/api/menus/:id", async (req, res) => {
  try {
    const {
      Menu_Name,
      Menu_Price,
      Category_Image,
      category_category_Id,
    } = req.body;
    await pool.query(
      "UPDATE Menu SET Menu_Name=?, Menu_Price=?, Category_Image=?,  category_category_Id=? WHERE Menu_Id=? AND deleted_at IS NULL",
      [
        Menu_Name,
        Menu_Price,
        Category_Image,
        category_category_Id,
        req.params.id,
      ],
    );
    res.status(200).json({ success: true, message: "Updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/menus/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Menu SET deleted_at = CURRENT_TIMESTAMP WHERE Menu_Id = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📌 7. Order_Detail API
// ==========================================
app.get("/api/order-details", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM Order_Detail WHERE deleted_at IS NULL",
    );
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/order-details", async (req, res) => {
  try {
    const { OrderDetail_Quantity, OrderDetail_Price, Menu_Menu_Id } = req.body;
    const id = uuidv4();
    await pool.query(
      "INSERT INTO Order_Detail (OrderDetail_Id, OrderDetail_Quantity, OrderDetail_Price, Menu_Menu_Id) VALUES (?, ?, ?, ?)",
      [id, OrderDetail_Quantity, OrderDetail_Price, Menu_Menu_Id],
    );
    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/order-details/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE Order_Detail SET deleted_at = CURRENT_TIMESTAMP WHERE OrderDetail_Id = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// 📌 8. Order API
// ==========================================


// ดึงข้อมูลตะกร้าสินค้าของลูกค้า
app.get("/api/cart/:customerId", async (req, res) => {
  // รับค่า Customer_Id จาก URL (เช่น /api/cart/cust-0001)
  const customerId = req.params.customerId;

  console.log("Fetching cart for Customer_Id:", customerId);
  if (!customerId) {
    return res.status(400).json({ 
      success: false, 
      message: "ไม่พบข้อมูลรหัสลูกค้า" 
    });
  }

  try {
    // ใช้ SQL JOIN ที่พี่เตรียมไว้เป๊ะๆ เลยครับ
    const sql = `
      SELECT 
          od.OrderDetail_Id, 
          m.Menu_Name, 
          od.OrderDetail_Price, 
          od.OrderDetail_Quantity 
      FROM \`Order\` o
      JOIN Order_Detail od ON o.Order_Id = od.Order_Id
      JOIN Menu m ON od.Menu_Menu_Id = m.Menu_Id
      WHERE o.Customer_Customer_Id = ? AND o.Order_status = 0
    `;

    const [items] = await pool.query(sql, [customerId]);

    // ส่งข้อมูลกลับไปให้ Android
    // สังเกตว่าชื่อคอลัมน์จาก SQL จะตรงกับ @SerializedName ใน Kotlin พอดีเป๊ะ!
    res.status(200).json({
      success: true,
      items: items // ถ้าไม่มีของในตะกร้า items จะส่งกลับไปเป็น [] (Array ว่าง)
    });

  } catch (error) {
    console.error("Get Cart Error:", error);
    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการดึงข้อมูลตะกร้าสินค้า"
    });
  }
});

// 1. ดึงรายการบิลทั้งหมดของลูกค้า (สถานะ 2 = สั่งซื้อแล้ว)
app.get("/api/bills/:customerId", async (req, res) => {
    const { customerId } = req.params;
    const sql = `SELECT Order_Id, Order_Date, Order_NetPrice, Order_status 
                 FROM \`Order\` WHERE Customer_Customer_Id = ? AND Order_status = '1' 
                 ORDER BY Order_Date DESC`;
    const [rows] = await pool.query(sql, [customerId]);
    res.json({ success: true, bills: rows });
});

// 2. ดึงรายละเอียดในแต่ละบิล
app.get("/api/bill-details/:orderId", async (req, res) => {
    const { orderId } = req.params;
    const sql = `SELECT od.OrderDetail_Id, m.Menu_Name, od.OrderDetail_Price, od.OrderDetail_Quantity 
                 FROM Order_Detail od 
                 JOIN Menu m ON od.Menu_Menu_Id = m.Menu_Id 
                 WHERE od.Order_Id = ?`;
    const [rows] = await pool.query(sql, [orderId]);
    res.json({ success: true, items: rows });
});



app.post("/api/cart/add", async (req, res) => {
  const { Customer_Id, Cafe_ID, Menu_Id, Quantity, price } = req.body;

  console.log("Add to Cart Request:", { Customer_Id, Cafe_ID, Menu_Id, Quantity, price });

  if (!Customer_Id || !Cafe_ID || !Menu_Id || !Quantity) {
    return res.status(400).json({ success: false, message: "ข้อมูลไม่ครบถ้วน" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. ค้นหา Order ที่เป็นตะกร้า
    const [existingOrders] = await connection.query(
      `SELECT Order_Id FROM \`Order\` 
       WHERE Customer_Customer_Id = ? AND Cafe_Cafe_ID = ? AND Order_status = '0'`,
      [Customer_Id, Cafe_ID]
    );

    let orderId;

    if (existingOrders.length > 0) {
      orderId = existingOrders[0].Order_Id;
      console.log("Found existing order:", orderId);
    } else {
      orderId = `ordr-${uuidv4()}`; 
      
      // 👈 แก้จุดที่ 1: เติม Order_Id กลับเข้าไปในคำสั่ง INSERT
      const insertOrderSql = `
        INSERT INTO \`Order\` 
        (Order_Id, Order_Date, Order_TotalPrice, Order_SeviceFee, Order_Discount, Order_NetPrice, Order_status, Customer_Customer_Id, Cafe_Cafe_ID) 
        VALUES (?, NOW(), 0, 10.00, 0, 0, '0', ?, ?)
      `;
      // 👈 เติม orderId ลงไปใน Array
      await connection.query(insertOrderSql, [orderId, Customer_Id, Cafe_ID]); 
      console.log("Created new order:", orderId);
    }

    // 2. จัดการ Order_Detail
    const [existingDetails] = await connection.query(
      `SELECT OrderDetail_Id, OrderDetail_Quantity FROM Order_Detail 
       WHERE Order_Id = ? AND Menu_Menu_Id = ?`,
      [orderId, Menu_Id]
    );

    if (existingDetails.length > 0) {
      const detailId = existingDetails[0].OrderDetail_Id;
      // ป้องกัน NaN ด้วยการแปลงเป็น Number
      const newQuantity = Number(existingDetails[0].OrderDetail_Quantity) + Number(Quantity);

      await connection.query(
        `UPDATE Order_Detail SET OrderDetail_Quantity = ? WHERE OrderDetail_Id = ?`,
        [newQuantity, detailId]
      );
      console.log("Updated existing menu quantity:", newQuantity);

    } else {
      // 👈 สร้าง ID ของ OrderDetail เป็น UUID ด้วย
      const orderDetailId = `ordd-${uuidv4()}`;
      
      // 👈 แก้จุดที่ 2: เติม OrderDetail_Id เข้าไปในคำสั่ง INSERT
      const insertDetailSql = `
        INSERT INTO Order_Detail (OrderDetail_Id, Order_Id, Menu_Menu_Id, OrderDetail_Quantity, OrderDetail_Price) 
        VALUES (?, ?, ?, ?, ?)
      `;
      // 👈 เติม orderDetailId ลงไปใน Array
      await connection.query(insertDetailSql, [orderDetailId, orderId, Menu_Id, Quantity, price]);
      console.log("Inserted new menu to cart");
    }

    await connection.commit();
    connection.release();

    res.status(200).json({ success: true, message: "เพิ่มสินค้าลงตะกร้าเรียบร้อยแล้ว" });

  } catch (error) {
    await connection.rollback();
    connection.release();
    
    console.error("Cart Error:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการบันทึกข้อมูล" });
  }
});






app.get("/api/orders", async (req, res) => {
  try {
    const sql = `
            SELECT o.*, 
                   c.Customer_Name, s.Status_Name, p.Payment_Method
            FROM \`Order\` o
            LEFT JOIN Customer c ON o.Customer_Customer_Id = c.Customer_Id
            LEFT JOIN Status s ON o.Status_Status_ID = s.Status_ID
            LEFT JOIN Payment p ON o.Payment_Payment_Id = p.Payment_Id
            WHERE o.deleted_at IS NULL and Order_status = 1
        `;
    const [rows] = await pool.query(sql);
    res.status(200).json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});



// 1. API สำหรับอัปเดตจำนวนสินค้า (ทั้งบวกและลบ)
app.put("/api/cart/update", async (req, res) => {
  const { OrderDetail_Id, Quantity } = req.body;

  try {
    const sql = `UPDATE Order_Detail SET OrderDetail_Quantity = ? WHERE OrderDetail_Id = ?`;
    await pool.query(sql, [Quantity, OrderDetail_Id]);
    
    res.status(200).json({ success: true, message: "อัปเดตจำนวนเรียบร้อย" });
  } catch (error) {
    console.error("Update Cart Error:", error);
    res.status(500).json({ success: false, message: "อัปเดตไม่สำเร็จ" });
  }
});

// 2. API สำหรับลบสินค้าออกจากตะกร้า
app.delete("/api/cart/item/:id", async (req, res) => {
  const detailId = req.params.id;

  try {
    const sql = `DELETE FROM Order_Detail WHERE OrderDetail_Id = ?`;
    await pool.query(sql, [detailId]);
    
    res.status(200).json({ success: true, message: "ลบสินค้าเรียบร้อย" });
  } catch (error) {
    console.error("Delete Cart Item Error:", error);
    res.status(500).json({ success: false, message: "ลบไม่สำเร็จ" });
  }
});



// ── API: ดึงรายละเอียดสินค้าภายในออเดอร์ ──
app.get("/api/orders/:id/details", async (req, res) => {
  try {
    const orderId = req.params.id;

    // 👈 แก้ตรงชื่อตารางให้เป็น `OrderDetail` และ `Menu` (ตามที่ตั้งใน DB)
    const [rows] = await pool.query(
      `SELECT 
        od.OrderDetail_Id, 
        od.OrderDetail_Quantity, 
        od.OrderDetail_Price, 
        m.Menu_Name 
       FROM Order_Detail od
       JOIN Menu m ON od.Menu_Menu_Id = m.Menu_Id
       WHERE od.Order_Id = ? AND od.deleted_at IS NULL`,
      [orderId]
    );

    res.status(200).json({ 
      success: true, 
      data: rows 
    });
  } catch (error) {
    console.error(" Get Order Details Error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});


// ── API: อัปเดตสถานะออเดอร์ (เรียกจาก Android) ──
app.put("/api/orders/:id/status", async (req, res) => {
    try {
        const orderId = req.params.id;
        const { Status } = req.body; // รับค่า 'pending', 'preparing', 'completed' จากแอป

        // 👈 แปลงคำจากแอปให้เป็น Status_ID ตามรูปฐานข้อมูลของพี่
        let statusId;
        switch (Status.toLowerCase()) {
            case 'pending':
                statusId = 'stat-0000-0000-0000-000000000001';
                break;
            case 'preparing':
            case 'processing': // เผื่อแอปส่งคำนี้มา
                statusId = 'stat-0000-0000-0000-000000000002';
                break;
            case 'completed':
                statusId = 'stat-0000-0000-0000-000000000003';
                break;
            default:
                // ถ้าแอปส่ง ID มาตรงๆ อยู่แล้ว หรือส่งค่าอื่นมา
                statusId = Status; 
        }

        const sql = "UPDATE `Order` SET Status_Status_ID = ? WHERE Order_Id = ? AND deleted_at IS NULL";
        const [result] = await pool.query(sql, [statusId, orderId]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: "ไม่พบออเดอร์นี้" });
        }

        res.status(200).json({ success: true, message: "อัปเดตสถานะสำเร็จ" });

    } catch (error) {
        console.error("🔥 Update Status Error:", error);
        res.status(500).json({ success: false, message: "ID สถานะไม่ถูกต้องตามเงื่อนไขฐานข้อมูล" });
    }
});



app.post("/api/orders", async (req, res) => {
  try {
    const {
      Order_Date,
      Order_TotalPrice,
      Order_SeviceFee,
      Order_Discount,
      Order_NetPrice,
      Customer_Customer_Id,
      Cafe_Cafe_ID,
      Order_Detail_OrderDetail_Id,
      Payment_Payment_Id,
      Status_Status_ID,
    } = req.body;
    const id = uuidv4();

    const sql = `INSERT INTO \`Order\` 
            (Order_Id, Order_Date, Order_TotalPrice, Order_SeviceFee, Order_Discount, Order_NetPrice, Customer_Customer_Id, Cafe_Cafe_ID, Order_Detail_OrderDetail_Id, Payment_Payment_Id, Status_Status_ID) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    await pool.query(sql, [
      id,
      Order_Date || new Date(),
      Order_TotalPrice,
      Order_SeviceFee,
      Order_Discount,
      Order_NetPrice,
      Customer_Customer_Id,
      Cafe_Cafe_ID,
      Order_Detail_OrderDetail_Id,
      Payment_Payment_Id,
      Status_Status_ID,
    ]);

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ยืนยันการสั่งซื้อ (เปลี่ยนสถานะตะกร้า 0 -> 1 และบันทึกยอดเงิน)
app.put("/api/orders/confirm", async (req, res) => {
  const { agencyId, netTotal } = req.body; // ใช้ agencyId ตามโครงสร้างระบบของพี่ครับ

  console.log("Confirm Order Request:", { agencyId, netTotal });
  if (!agencyId) {
    return res.status(400).json({ success: false, message: "ไม่พบข้อมูลผู้ใช้งาน" });
  }

  try {
    // อัปเดตสถานะเป็น 1 และบันทึกยอด NetPrice เฉพาะออเดอร์ที่ยังเป็นตะกร้า (0)
    const sql = `
      UPDATE \`Order\` 
      SET Order_status = '1', Order_NetPrice = ? 
      WHERE Customer_Customer_Id = ? AND Order_status = '0'
    `;
    
    const [result] = await pool.query(sql, [netTotal, agencyId]);

    if (result.affectedRows > 0) {
      res.status(200).json({ success: true, message: "ยืนยันการสั่งซื้อสำเร็จ" });
    } else {
      res.status(400).json({ success: false, message: "ไม่พบตะกร้าสินค้าที่สามารถสั่งซื้อได้" });
    }
  } catch (error) {
    console.error("Confirm Order Error:", error);
    res.status(500).json({ success: false, message: "เกิดข้อผิดพลาดในการยืนยันคำสั่งซื้อ" });
  }
});


app.put("/api/orders/:id", async (req, res) => {
  try {
    const { Status_Status_ID } = req.body; // ตัวอย่างการอัปเดตแค่สถานะ (นำไปปรับเพิ่มฟิลด์ได้)
    await pool.query(
      "UPDATE \`Order\` SET Status_Status_ID=? WHERE Order_Id=? AND deleted_at IS NULL",
      [Status_Status_ID, req.params.id],
    );
    res.status(200).json({ success: true, message: "Updated successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete("/api/orders/:id", async (req, res) => {
  try {
    await pool.query(
      "UPDATE \`Order\` SET deleted_at = CURRENT_TIMESTAMP WHERE Order_Id = ?",
      [req.params.id],
    );
    res.status(200).json({ success: true, message: "Deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==========================================
// Start Server
// ==========================================
const PORT = process.env.PORT || 3520;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
