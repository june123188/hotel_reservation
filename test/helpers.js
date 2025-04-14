const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

exports.setupTestDB = () => {
  let mongoServer;

  before(async function() {
    this.timeout(30000);
    // 确保连接关闭后重新连接
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
    // 强制同步索引
    await mongoose.model('User').createIndexes();
  });

  afterEach(async function() {
    this.timeout(30000);
    // 清理所有数据
    await mongoose.connection.dropDatabase();
  });

  after(async function() {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
};

exports.mockAuthorization = (user) => {
  return {
    'Authorization': `Bearer ${user.generateAuthToken()}`
  };
};