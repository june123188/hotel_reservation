const { expect } = require('chai');
const { setupTestDB } = require('../helpers');
const User = require('../../models/User');
const Reservation = require('../../models/Reservation');
const bcrypt = require('bcryptjs');

describe('Data Models', function() {
  this.timeout(30000);  // 设置全局超时时间
  setupTestDB();

  describe('User Model', function() {
    it('should hash password before saving', async function() {
      const user = new User({
        username: 'Test User',
        email: 'test@example.com',
        password: 'password123'
      });
      
      await user.save();
      expect(user.password).to.not.equal('password123');
      expect(bcrypt.compareSync('password123', user.password)).to.be.true;
    });

    it('should require email field', async function() {
      const user = new User({ username: 'Test', password: 'pass' });
      try {
        await user.save();
      } catch (err) {
        expect(err.errors.email).to.exist;
      }
    });
  });

  describe('Reservation Model', function() {
    let testUser;

    beforeEach(async () => {
      // 创建测试用户供预约关联
      testUser = new User({
        username: 'Test Owner',
        email: 'owner@test.com',
        password: 'password123'
      });
      await testUser.save();
    });

    it('should default status to requested', async function() {
      // 创建预约时关联用户ID
      const reserve = new Reservation({
        userId: testUser._id,
        guestName: 'Test',
        phone: '123456',
        email: 'test@example.com',
        arrivalTime: new Date(),
        tableSize: 4
      });
      
      await reserve.save();
      expect(reserve.status).to.equal('requested');
    });

    it('should validate tableSize', async function() {
      const reserve = new Reservation({
        userId: testUser._id,
        guestName: 'Test',
        phone: '123456',
        email: 'test@example.com',
        arrivalTime: new Date(),
        tableSize: 0  // invalid size
      });
      
      try {
        await reserve.save();
        throw new Error('Validation should have failed');
      } catch (err) {
        expect(err.name).to.equal('ValidationError');
        expect(err.errors.tableSize).to.exist;
        expect(err.errors.tableSize.message).to.include('至少需要 1 人');
      }
    });
  });
});