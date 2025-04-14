const mongoose = require('mongoose');

const reservationSchema = new mongoose.Schema({
  guestName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true },
  arrivalTime: { type: Date, required: true },
  tableSize: { type: Number, required: true,min: [1, '至少需要 {MIN} 人']},  // 确保设置最小值,
  status: {
    type: String,
    enum: ['requested', 'approved', 'cancelled', 'completed'],
    default: 'requested'
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Reservation', reservationSchema);