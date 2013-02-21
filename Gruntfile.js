module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      files: ['*.js', 'lib/*.js', 'lib/*/*.js'],
      test: ['test/*.coffee', 'test/*/*.coffee'],
      options: {
        curly: true,
        immed: true,
        indent: 2,
        latedef: true,
        newcap: true,
        quotemark: true,
        undef: true,
        unused: true,
        trailing: true,
        maxstatements: 80,
        maxlen: 80,
        node: true
      },
    },
    shell: {
      test: {
        command: 'make test'
      },
      'test-cov': {
        command: 'make test-cov'
      },
      clean: {
        command: 'rm -rf lib-cov; rm coverage.html; rm test-out.tmp'
      }
    }
  }); 
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-shell');
  grunt.registerTask('default', 'jshint');
  grunt.registerTask('lint', 'jshint');
  grunt.registerTask('test', ['jshint', 'test']);
  grunt.registerTask('test-cov', ['jshint', 'test-cov']);
  grunt.registerTask('clean', 'clean');
}
