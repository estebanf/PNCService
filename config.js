module.exports = {
  port: process.env.PORT || 3000,
  bpms: process.env.BPMSURL || 'http://bpms.everteam.us:8080/everteam',
  fa: process.env.FAURL || 'http://fa.everteam.us:8080',
  solr: process.env.SOLRURL || 'http://fa.everteam.us:8983/solr/fs-docs'
}
