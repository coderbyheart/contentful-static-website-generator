.PHONY: dist

dist:
	rm -rf $@
	./node_modules/.bin/babel src -d $@
