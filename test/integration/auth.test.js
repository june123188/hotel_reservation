const { expect } = require('chai');
const request = require('supertest');
const { setupTestDB } = require('../helpers');
const { app, configureServer } = require('../../server');
const User = require('../../models/User');

describe('Authentication API', function() {
  this.timeout(30000);  // 设置全局超时时间
  
  before(async () => {
    await configureServer(); // 必须等待配置完成
  });

  setupTestDB();

  describe('POST /api/auth/register', function() {
    it('Should handle validation errors (400)', async () => {
      const res = await request(app)
      .post('/api/auth/register')
      .send({})
        
      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/User validation failed/);
    });
    it('should register a new user', async function() {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'Test User',
          email: 'test@example.com',
          password: 'password123',
          phone: '123-456-7890'
        });

      expect(res.status).to.equal(201);
      expect(res.body.data).to.have.property('_id');
    });

    it('should deny duplicate email registration', async function() {
      await new User({
        username: 'Existing',
        email: 'test@example.com',
        password: 'password'
      }).save();

      // 验证数据库状态
      const count = await User.countDocuments({ email: 'test@example.com' });
      expect(count).to.equal(1); // 添加此断言确认数据存在

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.match(/Email already registered/);
    });
  });

  describe('POST /api/auth/login', function() {
    beforeEach(async function() {
      await new User({
        username: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      }).save();
    });

    it('email and password do not exist', async () => { 
      const res = await request(app)
      .post('/api/auth/login')
      .send({
        password: 'password123'
      });

      expect(res.status).to.equal(400);
      expect(res.body.message).to.equal('Please provide email and password');
    });

    it('should login with correct credentials', async function() {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });

      expect(res.status).to.equal(200);
      expect(res.body).to.have.property('token');
    });

    it('should reject invalid password', async function() {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });

      expect(res.status).to.equal(401);
    });
  });
});