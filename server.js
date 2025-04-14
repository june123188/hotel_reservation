require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const apolloServer = require('./schema');
const logger = require('./config/logger');

// 创建 Express 应用实例（提升到模块作用域）
const app = express();

// 中间件配置
app.use(cors());
app.use(express.json());

async function configureServer() {
  if (!app._configured) {
    // 数据库连接
    connectDB();

    // REST 路由
    app.use('/api/auth', authRoutes);

    // Apollo Server 配置
    await apolloServer.start();
    apolloServer.applyMiddleware({ app, path: '/graphql' });
    app._configured = true;
  }
}

// 只在非测试环境启动监听
if (process.env.NODE_ENV !== 'test') {
  configureServer()
    .then(() => {
      const PORT = process.env.PORT || 4000;
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
        console.log(`GraphQL endpoint: http://localhost:${PORT}${apolloServer.graphqlPath}`);
      });
    })
    .catch(error => {
      logger.error(`Failed to start server: ${error}`);
      process.exit(1);
    });
}

// 导出配置好的 Express 实例（测试环境使用）
module.exports = {
  app,
  configureServer // 可选，如果测试需要单独配置
};
