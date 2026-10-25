import express from 'express'
import {registerUser,loginUser} from './auth.controller.js'

const registerRouter = express.Router() ;
const loginRouter = express.Router() ;

registerRouter.post('/register', registerUser);

loginRouter.post('/login', loginUser);

export {registerRouter,loginRouter} ;