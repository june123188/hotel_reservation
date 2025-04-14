const { expect } = require('chai');
const { setupTestDB, mockAuthorization } = require('../helpers');
const request = require('supertest');
const { app, configureServer }= require('../../server');
const User = require('../../models/User');
const Reservation = require('../../models/Reservation');
const { logger } = require("../../config/logger");
const jwt = require('jsonwebtoken');
const { query } = require('express');

describe('Reservation API', function() {
  this.timeout(30000);  // 设置全局超时时间

  before(async () => {
    await configureServer(); // 必须等待配置完成
  });

  setupTestDB();

  let guestUser, staffUser, nowDate, testDate;

  beforeEach(async function() {
    testDate = new Date().toISOString().split('T')[0];
    nowDate = new Date(testDate)
    guestUser = new User({
      username: 'Guest',
      email: 'guest@example.com',
      password: 'password',
      role: 'guest',
      createdAt: nowDate
    })
    await guestUser.save();

    staffUser = new User({
      username: 'Staff',
      email: 'staff@example.com',
      password: 'password',
      role: 'staff'
    })
    await staffUser.save();
  });

  describe('GraphQL Operations', function() {
    const createReservationMutation = `
      mutation CreateReservation($guestName: String!,$phone: String!,$email: String!,$arrivalTime: String!,$tableSize: Int!) {
        createReservation(guestName:$guestName,phone:$phone,email:$email,arrivalTime:$arrivalTime,tableSize:$tableSize) {
          id
          status
        }
      }
    `;

    it('requests without tokens should be rejected', async function() {
      const res = await request(app)
        .post('/graphql')
        .send({
          query: `{ reservations { id } }`
        });

      expect(JSON.parse(res.text).errors[0].message).to.include('无效的 Token 格式');
    });

    it('reject non-existent users', async () => {
      const token = jwt.sign(
        { id: "5a9427648b0beebeb6957a88", role: 'guest' },
        process.env.JWT_SECRET || 'your_secret_key'
      );
  
      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `{ reservations { id } }`,
          headers: { authorization: 'Bearer invalid.token' }
        });
      
        expect(JSON.parse(res.text).errors[0].message).to.include('用户不存在');
    });

    it('reservation should be able to be queried by ID', async function() {
      const token = jwt.sign(
        { id: guestUser._id, role: 'guest' },
        process.env.JWT_SECRET || 'your_secret_key'
      );

      // 创建初始预订
      const reservation = await Reservation.create({
        guestName: 'Test',
        phone: '123456',
        email: 'test@example.com',
        arrivalTime: new Date(),
        tableSize: 4,
        userId: guestUser._id,
        createdAt: testDate
      });

      const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query($id: ID!) {
            reservation(id: $id ) { id status }
          }
        `,
        variables: { id: reservation._id},
        headers: { authorization: 'Bearer valid.token' }
      });

      expect(res.body.errors).to.exist;
    });

    it('reservation should be filtered by status and date', async function() {
      const token = jwt.sign(
        { id: guestUser._id, role: 'guest' },
        process.env.JWT_SECRET || 'your_secret_key'
      );

      // 创建初始预订
      await Reservation.create({
        guestName: 'Test',
        phone: '123456',
        email: 'test@example.com',
        arrivalTime: new Date(),
        tableSize: 4,
        userId: guestUser._id,
        createdAt: testDate
      });

      const res = await request(app)
      .post('/graphql')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: `
          query($status: Status!,$date: String!) {
            reservations(status: $status, date: $date ) { id status }
          }
        `,
        variables: { status: "requested", date: testDate},
        headers: { authorization: 'Bearer valid.token' }
      });

      expect(res.body.data.reservations).to.have.length(1);
      expect(res.body.data.reservations[0].status).to.equal('requested');
    });

    it('should create reservation with authenticated user', async function() {
      const token = jwt.sign(
        { id: guestUser._id, role: 'guest' },
        process.env.JWT_SECRET || 'your_secret_key'
      );

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: createReservationMutation,
          variables: {
            guestName: 'Test',
            phone: '123456',
            email: 'test@example.com',
            arrivalTime: new Date().toISOString(),
            tableSize: 4,
            userId: guestUser._id.toString() // 添加用户关联
          }
        });

      expect(res.status).to.equal(200);
      expect(res.body.data.createReservation.status).to.equal('requested');
    });

    it('should update status if staff', async function() {
      // 创建初始预订
      const reservation = await Reservation.create({
        guestName: 'Test',
        phone: '123456',
        email: 'test@example.com',
        arrivalTime: new Date(),
        tableSize: 4,
        userId: guestUser._id
      });

      const updateMutation = `
        mutation UpdateStatus($id: ID!, $status: Status!) {
          updateReservationStatus(id: $id, status: $status) {
            id
            status
          }
        }
      `;

      const token = jwt.sign(
        { id: staffUser._id, role: 'staff' },
        process.env.JWT_SECRET || 'your_secret_key'
      );

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: updateMutation,
          variables: {
            id: reservation._id.toString(),
            status: 'approved'
          }
        });

      expect(res.status).to.equal(200);
      expect(res.body.data.updateReservationStatus.status).to.equal('approved');
    });

    it('Reservation should be cancelled', async () => {
      // 创建初始预订
      const reservation = await Reservation.create({
        guestName: 'Test',
        phone: '123456',
        email: 'test@example.com',
        arrivalTime: new Date(),
        tableSize: 4,
        userId: guestUser._id
      });

      const token = jwt.sign(
        { id: staffUser._id, role: 'staff' },
        process.env.JWT_SECRET || 'your_secret_key'
      );

      const res = await request(app)
        .post('/graphql')
        .set('Authorization', `Bearer ${token}`)
        .send({
          query: `
            mutation($id: ID!) {
              cancelReservation(id: $id) { status }
            }
          `,
          variables: { id: reservation._id },
          headers: { authorization: 'Bearer valid.token' }
        });

      expect(res.body.data.cancelReservation.status).to.equal('cancelled');
    });
  });
});