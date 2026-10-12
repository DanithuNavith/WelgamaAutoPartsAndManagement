const removeLegacyTechnicianMetrics = async ({ JobCard, Sale, Technician }) => {
  const unsetJobMetrics = {
    technicianHours: '',
    technicianRate: '',
    estimatedCost: ''
  };
  const [jobs, sales, technicians] = await Promise.all([
    JobCard.updateMany({}, { $unset: unsetJobMetrics }, { strict: false }),
    Sale.updateMany({}, { $unset: unsetJobMetrics }, { strict: false }),
    Technician.updateMany({}, { $unset: { hourlyRate: '' } }, { strict: false })
  ]);
  return jobs.modifiedCount + sales.modifiedCount + technicians.modifiedCount;
};

module.exports = { removeLegacyTechnicianMetrics };
