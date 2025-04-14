const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { authLogger } = require('../config/logger')

// 注册
exports.register =  async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    authLogger.error(`Request error:${errors.array()}`);
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const existingUser = await User.findOne({ email: req.body.email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    } 
    
    const newUser = await User.create({
      username: req.body.username,
      email: req.body.email,
      password: req.body.password,
      role: req.body.role
    });

    // 生成JWT
    const token = jwt.sign(
      { id: newUser._id }, 
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    authLogger.info(`email register success!`)
    res.status(201).json({
      status: 'success',
      token,
      data: {
        _id: newUser._id,
        user: newUser
      }
    });
  } catch (err) {
    authLogger.error(`register fail:${err.message}`)
    res.status(400).json({
      status: 'fail',
      message: err.message
    });
  }
};

// 登录
exports.login = async (req, res) => {
    const { email, password } = req.body;
  
    // 1) 检查邮箱和密码是否存在
    if (!email || !password) {
      authLogger.error(`Please provide email or password !`)
      return res.status(400).json({
        status: 'fail',
        message: 'Please provide email and password'
      });
    }
  
    // 2) 验证用户
    const user = await User.findOne({ email }).select('+password');
  
    if (!user || !(await user.correctPassword(password, user.password))) {
      authLogger.error(`Incorrect email: ${email} or password!`)
      return res.status(401).json({
        status: 'fail',
        message: 'Incorrect email or password'
      });
    }
  
    // 3) 生成token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );
  
    authLogger.info(`login success!`)
    res.status(200).json({
      status: 'success',
      token
    });
}