const backfillJobCardNames = async JobCard => {
  const jobCards = await JobCard.find({
    $or: [
      { customerName: { $exists: false } },
      { customerName: '' },
      { technicianName: { $exists: false } },
      { technicianName: '' }
    ]
  }).populate('customer', 'name').populate('technician', 'name');

  const updates = jobCards.flatMap(job => {
    const fields = {};
    if (!job.customerName && job.customer?.name) fields.customerName = job.customer.name;
    if (!job.technicianName && job.technician?.name) fields.technicianName = job.technician.name;
    return Object.keys(fields).length
      ? [{ updateOne: { filter: { _id: job._id }, update: { $set: fields } } }]
      : [];
  });

  if (!updates.length) return 0;
  const result = await JobCard.bulkWrite(updates);
  return result.modifiedCount;
};

module.exports = { backfillJobCardNames };
