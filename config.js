module.exports = {
  port: process.env.PORT || 3000,
  bpms: process.env.BPMSURL || 'http://process.everteam.us:8080/everteam',
  fa: process.env.FAURL || 'http://discover.everteam.us:8080',
  solr: process.env.SOLRURL || 'http://discover.everteam.us:8983/solr/fs-docs',
  archivePath: process.env.ARCHIVEPATH || '/home/centos/archiveJob'
  // archivePath: process.env.ARCHIVEPATH || '/Users/estebanf/development/archiveJob'
}
