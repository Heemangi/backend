const port = 4000;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const cors = require("cors");

app.use(express.json());
app.use(cors());


require('dotenv').config();

const mongoURI = process.env.MONGO_URI; 
mongoose.connect(mongoURI)
    .then(() => {
        console.log('Connected to MongoDB');
        
    })
    .catch(error => {
        console.error('Error connecting to MongoDB:', error);
    });

app.get("/",(req,res)=>{
    res.send("Express App is Running");
})

const storage = multer.diskStorage({
    destination: './upload/images',
    filename:(req,file,cb)=>{
        return cb(null,`${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`)
    }
})


const upload = multer({storage:storage})

app.use('/images',express.static('upload/images'))

app.post("/upload",upload.single('product'),(req,res)=>{
    res.json({
        success:1,
        image_url:`http://localhost:${port}/images/${req.file.filename}`,
    })
})

//Schema

const Product = mongoose.model("Product",{
    id:{
        type:Number,
        required:true,
    },
    name:{
        type:String,
        required:true,
    },
    image:{
        type:String,
        required:true,
    },
    category:{
        type:String,
        required:true,
    },
    price:{
        type:Number,
        required:true,
    },
    date:{
        type:Date,
        default:Date.now,
    },
    available:{
        type:Boolean,
        default:true
    }
})

//Endpoint for product upload
app.post('/addproduct', async(req,res)=>{
    let products = await Product.find({});
    let id;
    if(products.length>0)
    {
        let last_product_array = products.slice(-1);
        let last_product = last_product_array[0];
        id = last_product.id+1;
    }
    else{
        id=1;
    }
    
    const product = new Product({
        id:id,
        name:req.body.name,
        image:req.body.image,
        category:req.body.category,
        price:req.body.price
    });
    // console.log(product);
    await product.save(); //Savng in db
    console.log("Saved");
    res.json({
        success:true,
        name:req.body.name,
    })
})

//Remove Product
app.post('/removeproduct',async(req,res)=>{
    await Product.findOneAndDelete({id:req.body.id});
    // console.log("Removed");
    res.json({
        success:true,
        name:req.body.name,
    })
})

//Creating API for getting all products
app.get('/allproducts', async(req,res)=>{
    let products = await Product.find({});
    // console.log("All products fetched");
    res.send(products);
})

//Schema creation for user model
const Users = mongoose.model('Users', {
    name:{
        type:String,
    },
    email:{
        type:String,
        unique:true,
    },
    password:{
        type:String,
    },
    cartData:{
        type:Object,
    },
    date:{
        type:Date,
        default:Date.now,
    }
})

//Creating Endpoint for registering the user
app.post('/signup',async(req,res)=>{
    let check = await Users.findOne({email:req.body.email});
    if(check){
        return res.status(400).json({success:false,errors:"Existing user found with same email"})
    }
    let cart={}
    for(let i=0;i<300;i++){
        cart[i]=0;
    }
    const user = new Users({
        name:req.body.name,
        email:req.body.email,
        password:req.body.password,
        cartData:cart,
    })
    await user.save();

    const data = {
        user:{
            id:user.id
        }
    }

    const token = jwt.sign(data,'secret_ecom');
    res.json({success:true,token})
})

//Creating Endpoint for user login
app.post('/login',async(req,res)=>{
    let user = await Users.findOne({email:req.body.email});
    if(user){
        const passCompare = req.body.password===user.password;
        if(passCompare){
            const data={
                user:{
                    id:user.id
                }
            }
            const token = jwt.sign(data,'secret_ecom');
            res.json({success:true,token})
        }
        else{
            res.json({success:false,errors:"Wrong Password"});
        }
    }
    else{
        res.json({success:false,errors:"Wrong Email Id"})
    }
})

//Middleware to fetch user
const fetchUser = async(req,res,next)=>{
    const token = req.header('auth-token');
    if(!token){
        res.status(401).send({errors:"Please authenticate using valid token"})
    }
    else{
        try{
            const data = jwt.verify(token,'secret_ecom');
            req.user=data.user;
            next();
        }catch(error){
            res.status(401).send({errors:"Please authenticate using a valid token"})
        }
    }
}

//Adding products to cart
app.post('/addtocart',fetchUser,async(req,res)=>{
    console.log("added",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    userData.cartData[req.body.itemId] += 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Added")
})

//Remove Product from cartData
app.post('/removefromcart',fetchUser,async(req,res)=>{
    console.log("removed",req.body.itemId);
    let userData = await Users.findOne({_id:req.user.id});
    if( userData.cartData[req.body.itemId]>0){
    userData.cartData[req.body.itemId] -= 1;
    await Users.findOneAndUpdate({_id:req.user.id},{cartData:userData.cartData});
    res.send("Added");
    }
})

//Getting user's cart data
app.post('/getcart',fetchUser,async(req,res)=>{
    console.log("GetCart")
    let userData = await Users.findOne({_id:req.user.id});
    res.json(userData.cartData);
})

app.get('/search', async (req, res) => {
    try {
        const query = req.query.q.toLowerCase();
        // Use Mongoose's find method to search for products
        const searchResults = await Product.find({ name: { $regex: new RegExp(query, 'i') } });
        res.json(searchResults);
    } catch (error) {
        console.error('Error fetching search results:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.listen(port, (error) => {
    if(!error) {
        console.log("Server Running on port" + port)
    }
    else{
        console.log("Error" + error )
    }
})