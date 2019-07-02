cd packages

cd utils
npm link
cd ..

cd app
npm link
npm link @pema/utils
cd ..

cd app-react
npm link
npm link @pema/utils
npm link @pema/app
cd ..

cd router
npm link
npm link @pema/utils
npm link @pema/app
cd ..

cd router-react
npm link
npm link
npm link @pema/utils
npm link @pema/app
npm link @pema/app-react
npm link @pema/router
cd ..
