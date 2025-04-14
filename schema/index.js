const { ApolloServer } = require('apollo-server-express');
const { parse } = require('graphql');
const User = require("../models/User")
const Reservation = require('../models/Reservation');
const jwt = require('jsonwebtoken');
const { logger } = require("../config/logger");

const typeDefs = parse(`
  enum Status {
    requested
    approved
    cancelled
    completed
  }

  type Reservation {
    id: ID!
    guestName: String!
    phone: String!
    email: String!
    arrivalTime: String!
    tableSize: Int!
    status: Status!
    userId: ID!
  }

  type Query {
    reservations(status: Status, date: String): [Reservation]
    reservation(id: ID!): Reservation
  }

  type Mutation {
    createReservation(
      guestName: String!
      email: String!
      phone: String
      arrivalTime: String!
      tableSize: Int!
    ): Reservation
    
    updateReservationStatus(id: ID!, status: Status!): Reservation
    cancelReservation(id: ID!): Reservation
  }
`);

const resolvers = {
  Query: {
    reservations: async (_, { status, date }, { user }) => {
      const query = {};
      if (status) query.status = status;
      if (date) {
        const startDate = new Date(date);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 1);
        query.createdAt = { $gte: startDate, $lt: endDate };
      }
      return Reservation.find(query);
    },
    reservation: (_, { id }) => Reservation.findById(id)
  },
  Mutation: {
    createReservation: async (_, args, { user }) => {
      const reservation = new Reservation({
        ...args,
        userId: user.id
      });
      return reservation.save();
    },
    updateReservationStatus: async (_, { id, status }, { user }) => {
      return Reservation.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );
    },
    cancelReservation: async (_, { id }) => {
      return Reservation.findByIdAndUpdate(
        id,
        { status: 'cancelled' },
        { new: true }
      )
    }
  }
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context: async ({ req }) => {
    // 1. 从请求头获取 JWT Token
    const token = req.headers.authorization || '';

    // 2. 检查 Token 格式
    if (!token.startsWith('Bearer ')) {
      logger.error(`无效的 Token 格式，应为 Bearer <token>`);
      throw new Error('无效的 Token 格式，应为 Bearer <token>');
    }

    try {
      // 3. 提取并验证 Token
      const decodedToken = jwt.verify(
        token.replace('Bearer ', ''), // 移除 "Bearer " 前缀
        process.env.JWT_SECRET,       // 从环境变量读取密钥
        { algorithms: ['HS256'] }     // 指定签名算法
      );

      // 4. 根据 Token 中的用户信息查询数据库
      const user = await User.findById(decodedToken.id);
      if (!user) {
        throw new Error('用户不存在');
      }

      logger.info(`GraphQL operation success!`)
      // 5. 将用户信息附加到上下文
      return { user };
    } catch (err) {
      logger.error(`GraphQL operation Authentication failed: ${err.message}`);
      // 捕获 Token 过期、篡改等错误
      throw new Error(`Authentication failed: ${err.message}`);
    }
  }
});

module.exports = server;