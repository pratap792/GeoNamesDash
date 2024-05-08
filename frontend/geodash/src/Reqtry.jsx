/* eslint-disable no-unused-vars */
import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import { Bar, Doughnut } from 'react-chartjs-2';
import { MDBDataTable } from 'mdbreact';
import 'mdbreact/dist/css/mdb.css';
import './css/filters.css';

let pieData = {
  labels: [],
  datasets: [],
};
const barChartOptions = {
  scales: {
    x: {
      grid: {
        display: false,
      },
    },
    y: {
      grid: {
        display: false,
      },
    },
  },

  plugins: {
    title: {
      display: true,
      text: 'Filtered Results',
    },
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
    },
  },
};

const pieChartOptions = {
  plugins: {
    title: {
      display: true,
      text: 'All Clients',
    },
    legend: {
      display: false,
    },
    tooltip: {
      enabled: true,
    },
  },
};

let barData = {
  labels: [],
  datasets: [],
};

const Req = () => {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [submittedDates, setSubmittedDates] = useState(null);
  const [clients, setClients] = useState([]);
  const [options, setoptions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [tableData, setTableData] = useState({});
  const [exportData, setExportData] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalData, setModalData] = useState('');

  useEffect(() => {
    getGraph();
    getDataPage();
  }, []);

  const handleModal = (jsonString) => {
    setModalData(jsonString);

    setModalOpen(true);
  };

  const getGraph = () => {
    fetch(`http://localhost:3001/uniqueClientIds?fd=${fromDate}&td=${toDate}`)
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Error: ' + response.status);
        }
      })
      .then((data) => {
        const dt = data.map((d1) => {
          return { value: d1.id, label: d1.id };
        });
        setClients(dt);
        const countData = data.map((d1) => {
          return { id: d1.id, count: d1.count };
        });

        const pieId = countData.map((item) => item.id);
        const pieCount = countData.map((item) => item.count);

        const pieChartData = {
          labels: pieId,
          datasets: [
            {
              label: 'ClientIds',
              barThickness: 10,
              maxBarThickness: 90,
              data: pieCount,
              borderWidth: 1,
            },
          ],
        };
        pieData = pieChartData;
      })
      .catch((error) => {
        console.error('Error fetching data:', error);
      });
  };

  const getDataPage = async () => {
    await fetch(
      `http://localhost:3001/filter?fd=${fromDate}&td=${toDate}&clients=${options.toString()}`
    )
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Error: ' + response.status);
        }
      })
      .then((data1) => {
        const barId = data1.summary.map((item) => item.id);
        const barCount = data1.summary.map((item) => item.count);

        const barChartData = {
          labels: barId,
          datasets: [
            {
              barThickness: 50,
              maxBarThickness: 90,
              label: 'API Requests',
              backgroundColor: 'rgba(193, 31, 39, 0.77)',
              data: barCount,
              borderWidth: 1,
            },
          ],
        };
        barData = barChartData;

        setExportData(data1.resp);
        return data1.resp.map((info) => {
          return {
            logId: info.logId,
            createdAt: info.createdAt,
            clientId: info.clientId,
            query: info.query,
            result: (
              <a onClick={() => handleModal(info.result)}>
                <u>Click here to view</u>
              </a>
            ),
          };
        });
      })
      .then((DisplayData1) => {
        console.log(DisplayData1);

        const data = {
          columns: [
            {
              label: 'Log Id',
              field: 'logId',
              sort: 'asc',
              width: 150,
            },
            {
              label: 'Created At',
              field: 'createdAt',
              sort: 'asc',
              width: 270,
            },
            {
              label: 'Client ID',
              field: 'clientId',
              sort: 'asc',
              width: 200,
            },
            {
              label: 'Query',
              field: 'query',
              sort: 'asc',
              width: 100,
            },
            {
              label: 'Result',
              field: 'result',
              sort: 'asc',
              width: 100,
            },
          ],
          rows: DisplayData1,
        };

        return data;
      })
      .then((data) => {
        setTableData(data);
        return true;
      })
      .catch((error) => {
        console.log('Error fetching data:', error);
      });
  };

  const handleExport = () => {
    fetch(
      `http://localhost:3001/export?fd=${fromDate}&td=${toDate}&clients=${options.toString()}`
    )
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          throw new Error('Error: ' + response.status);
        }
      })
      .then((url) => {
        const link = document.createElement('a');
        link.href = url.link;
        link.click();
      });
  };

  const handleChange = async (selected) => {
    setSelected(selected);
    const clientIds = await selected.map((item) => item.value);
    setoptions(clientIds);
  };

  const handleFromDateChange = (event) => {
    const date = event.target.value;
    setFromDate(date);

    if (new Date(date) > new Date(toDate)) {
      setToDate(date);
    }
    setSubmittedDates({ from_date: fromDate });
  };

  const handleToDateChange = (event) => {
    const date = event.target.value;
    setToDate(date);

    if (new Date(date) < new Date(fromDate)) {
      setFromDate(date);
      setSubmittedDates({ to_date: toDate });
    }
  };
  const handleSubmit = async (event) => {
    event.preventDefault();
    getDataPage(toDate, fromDate, options);
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setSelected('');
    setFromDate('');
    setToDate('');
  };

  return (
    <div>
      {modalOpen && (
        <div className="modalContainer">
          <div className="modal">
            <div className="modal-content">
              <span className="close" onClick={() => setModalOpen(false)}>
                &times;
              </span>
              <br />
              <pre id="resultModal">{modalData}</pre>
            </div>
          </div>
        </div>
      )}
      <form id="filterForm" onSubmit={handleSubmit}>
        <div id="inputs">
          <div>
            <label htmlFor="fromDate">From :</label>
            <input
              type="date"
              title="Select From Date"
              id="fromDate"
              value={fromDate}
              onChange={handleFromDateChange}
              defaultValue={new Date('1970-01-01')}
              min={'01-01-1970'}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>

          <div>
            <label htmlFor="toDate">To :</label>
            <input
              title="Select To Date"
              type="date"
              id="toDate"
              value={toDate}
              onChange={handleToDateChange}
              defaultValue={new Date()}
              min={fromDate}
              max={new Date().toISOString().split('T')[0]}
            />
          </div>
        </div>
        <div id="select" title="Select Clients">
          <Select
            id="client"
            isMulti
            isSearchable
            options={clients}
            name="client"
            placeholder="Choose clients"
            value={selected}
            onChange={handleChange}
            styles={{
              option: (provided, state) => ({
                ...provided,
                color: state.isSelected ? 'white' : 'black',
              }),
              control: (baseStyles, state) => ({
                ...baseStyles,
                borderColor: state.isFocused ? 'black' : 'grey',
                borderRadius: 100,
              }),
            }}
          />
        </div>

        <div id="buttons">
          <button id="submitButton" type="submit" title="Submit">
            Submit
          </button>

          <button
            id="resetButton"
            type="reset"
            onClick={handleReset}
            title="Reset Filters"
          >
            Reset
          </button>

          <img
            src="./file-export-solid.svg"
            id="export"
            onClick={handleExport}
            title="Export to CSV"
          ></img>
        </div>
      </form>

      <div id="barbox">
        <h2 id="heading">API User Report</h2>
        <div id="charts">
          <div id="piediv">
            <Doughnut id="piechart" data={pieData} options={pieChartOptions} />
          </div>
          <div id="bardiv">
            <Bar id="barchart" data={barData} options={barChartOptions} />
          </div>
        </div>
      </div>
      <div id="pgdata">
        <MDBDataTable bordered sortable={false} data={tableData}></MDBDataTable>
      </div>
    </div>
  );
};

export default Req;
