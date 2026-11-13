module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        jshint: {
            files: ['Gruntfile.js', 'src/**/*.js', 'spec/**/*.js'],
            options: {
                jshintrc: true
            }
        },
        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("dd-mm-yyyy") %> */\n'
            },
            dist: {
                files: {
                    'dist/<%= pkg.name.substring(pkg.name.lastIndexOf("/")+1) %>.min.js': ['src/dom-to-image.js']
                }
            }
        }
    });

    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-uglify');

    // the tests run with `npm test` (Web Test Runner)
    grunt.registerTask('default', ['jshint', 'uglify']);
};
