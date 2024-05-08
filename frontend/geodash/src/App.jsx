/* eslint-disable no-unused-vars */
// App.js
import React from 'react';
import Req from './Req';
import Charts from './Charts';
import Footer from './Footer';
import './css/filters.css';
import { MDBDataTable } from 'mdbreact';

import Reqtry from './Reqtry';

function App() {
  return (
    <div id="main">
      <nav>
        <img id="logo" src="/logo_aha.png" alt="" />
        <h1 id="title">GeoDash</h1>
      </nav>
      {/* <div id="barbox">
        <h2 id="heading">API User Report</h2>
        <div id="charts">
          <div id="piediv">
            <canvas id="piechart"></canvas>
          </div>
          <div id="bardiv">
            <canvas id="barchart"></canvas>
          </div>
        </div>
      </div>{' '} */}

      <Reqtry />
      {/* <Req /> */}
      <Footer />
    </div>
  );
}

export default App;
