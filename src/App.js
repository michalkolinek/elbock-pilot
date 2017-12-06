import React, {Component} from 'react';
import logo from './app-icon.png';
import './App.css';
import './icons.css';
import Base64 from 'base64-js';
import moment from 'moment';
import mqtt from 'mqtt';


export default class App extends Component {

	constructor(props) {
		super(props);

		this.state = {
			pending: false,
			actualTemp: null,
			extTemp: null,
			targetTemp: null,
			mode: null,
			plainData: null,
			messages: [],
			status: 'idle',
			deviceId: null,
			heating: null,
			tempInputOpen: false,
			modeInputOpen: false,
			targetTempInp: 20,
			modeInp: null
		};

		this.config = {
			subscribeTopic: 'testtopic2/',
			commandsTopic: 'testtopic/1',
			qos: 2,
			brokerDSN: 'ws://mqtt.elbock.cz:9001',
		};

		this.client = null;

		this.connectToBroker();
	}


	connectToBroker() {
		this.client = mqtt.connect(this.config.brokerDSN);
		this.client.on('connect', (connack) => this.onConnect(connack));
		this.client.on('offline', () => this.onConnectionLost());
		this.client.on('error', (error) => this.onError(error));
	}

	onConnectionLost() {
		this.setState({status: 'connection lost' });
	}

	onConnect() {
		this.setState({status: 'connected'});
		this.client.subscribe(this.config.subscribeTopic, {
			qos: this.config.qos
		}, (err, granted) => {
			if(err) {
				this.onSubscribeFailure(err);
			} else {
				this.onSubscribeSuccess(granted);
			}
		});
	}

	onError(error) {
		console.log(error);
		this.setState({status: 'connection failed'});
	}

	onSubscribeSuccess() {
		this.setState({status: 'subscribed'});
		this.client.on('message', (topic, message) => this.handleMessage(topic, message.toString()));
	}

	onSubscribeFailure() {
		this.setState({status: 'subscription failed'});
	}

	handleOnDisconnectClick() {
		if(this.state.status === 'connected') {
			this.client.disconnect();
		}
		this.setState({status: 'disconnected'});
	}

	handleOnReconnectClick() {
		this.handleOnDisconnectClick();
		this.connectToBroker();
	}

	handleActualTempCommandClick() {
		this.publish('06 00 00 00 05 00 04 fd fe 0d 0a');
	}

	handleConfCommandClick() {
		this.publish('06 00 00 00 02 00 00 fd fe 0d 0a');
	}

	handleOnClearClick() {
		this.setState({messages: []});
	}

	handleMessage(topic, message) {
		// const msg = 'BFYAAAAAAP3+DQo=';
		console.log(message);

		const d = new Date();
		const data = {
			time: d.getTime(),
			payload: this.decodeData(message)
		};

		let update = {
			status: 'receiving',
			plainData: message, messages: [...this.state.messages, data]
		};

		if(data.payload[0] === '23' && data.payload[1] === 'ff') {
			alert('Chybný příkaz');
		}

		else if(data.payload[0] === '05' && data.payload[1] === '04') {
			const temp = parseInt(data.payload[5], 16) + parseInt(data.payload[6], 16) / 10;
			update.actualTemp = temp;

			update.deviceId = data.payload[2] + data.payload[3] + data.payload[4];
		}

		else if(data.payload[0] === '05') {
			// TODO parsovat desetinna cisla
			const ext = parseInt(data.payload[2], 16); // + parseInt(data.payload[6], 16) / 10;
			update.extTemp = ext;

			const target = parseInt(data.payload[6], 16) / 2;
			update.targetTemp = target;
			update.targetTempInp = target;

			const bits1 = data.payload[5].toString(2);
			const bits2 = data.payload[6].toString(2);
			update.mode = bits1[0] ? 'auto' : 'manu';
			update.heating = !!bits2[6];

			update.deviceId = data.payload[2] + data.payload[3] + data.payload[4];
		} else {
			update.deviceId = data.payload[2] + data.payload[3] + data.payload[4];
		}

		this.setState(update);
	}

	publish(msg) {
		const hex = msg.split(' ');
		let chars = new Uint8Array(hex.length);
		hex.forEach((item, i) => {
			chars[i] = parseInt(item, 16);
		});
		const command = Base64.fromByteArray(chars);
		this.client.publish(this.config.commandsTopic, command, this.config.qos, false);
	}

	decodeData(msg) {
		let data = [];
		const int8array = Base64.toByteArray(msg);
		for(let i = 0; i < int8array.length; i++) {
			let char = int8array[i].toString(16);
			if(char.length < 2) {
				char = '0' + char;
			}
			data.push(char);
		}
		return data;
	}

	handleSetTempClick() {
		this.setState({tempInputOpen: true});
	}

	handleTargetTempChange(e) {
		this.setState({targetTempInp: e.target.value});
	}

	handleModeChange(e) {
		this.setState({modeInp: e.target.value});
	}

	setTargetTemp() {
		const temp = (this.state.targetTempInp * 2).toString(16);
		// const mode = '1'.toString(16);
		this.publish('02 00 00 54 00 00 ' + temp + ' fd fe 0d 0a');
		// this.publish('02 00 00 54 00 00 00 fd fe 0d 0a');
		this.setState({tempInputOpen: false, targetTemp: this.state.targetTempInp});
		console.log('Not implemented', temp);
	}

	handleSetModeClick() {
		this.setState({modeInputOpen: true});
	}


	setMode() {
		console.log('Not implemented', this.state.modeInp);
		this.setState({modeInputOpen: false, mode: this.state.modeInp});
	}

	render() {

		const messages = this.state.messages.map((item) => {
			const m = moment(item.time);
			return (
				<p key={item.time}>
					{m.format('H:mm:ss')}: {item.payload.join(' ')}
				</p>
			);
		});

		let reconButton = false;
		if(this.state.status !== 'subscribed' && this.state.status !== 'receiving') {
			reconButton = (
				<button className="icon-sync button-ico"
						title={'Reconnect'}
						onClick={(e) => this.handleOnReconnectClick(e) } />
			);
		}

		let tempForm = false;
		if(this.state.tempInputOpen) {
			tempForm = (
				<span className="input-wrap">
					<input type="number" step="0.5" value={this.state.targetTempInp} onChange={(e) => this.handleTargetTempChange(e)}/>°C
					<button className="button-imp" onClick={() => this.setTargetTemp()}>OK</button>
				</span>
			);
		}

		let modeForm = false;
		if(this.state.modeInputOpen) {
			modeForm = (
				<span className="input-wrap">
					<label>
						<input type="radio"
						   value="auto"
						   checked={this.state.modeInp == 'auto'}
						   onChange={(e) => this.handleModeChange(e)}/>
						Auto
					</label>
					<label>
						<input type="radio"
							   value="manu"
							   checked={this.state.modeInp == 'manu'}
							   onChange={(e) => this.handleModeChange(e)}/>
						Manual
					</label>
					<button className="button-imp" onClick={() => this.setMode()}>OK</button>
				</span>
			);
		}

		let decode = false;
		const toDecode = 'AgAAVAAAKv3+DQo=';
		if(toDecode) {
			decode = (
				<div>
					<h3>Decode message</h3>
					'{toDecode}' -> '{this.decodeData(toDecode).join(' ')}'
				</div>
			);
		}


		return (
			<div className="App">
				<header className="App-header">
					<img src={logo} className="App-logo" alt="logo"/>
					<h1 className="App-title">Elbock Web Control</h1>
				</header>

				<section className="App-body">
					<p>Aktuální teplota: {this.state.actualTemp}°C</p>
					<p>Externí teplota: {this.state.extTemp}°C</p>
					<p>Nastavená teplota: {this.state.targetTemp}°C
						<button onClick={() => this.handleSetTempClick()} className="button-ico icon-settings"></button>
						{tempForm}
					</p>
					<p>Režim: {this.state.mode}
						<button onClick={() => this.handleSetModeClick()} className="button-ico icon-settings"></button>
						{modeForm}
					</p>
					<p>Topí: {this.state.heating ? 'ANO' : 'NE'}</p>
					<br />
					<p>Device ID: {this.state.deviceId}</p>
					<p>Staus: {this.state.status} {reconButton}</p>
					<p>Plain data: {this.state.plainData}</p>

					<div style={{flexDirection: 'row', justifyContent: 'space-around', paddingTop: 10, paddingBottom: 10}}>
						<h3>Příkazy</h3>
						<button	onClick={(e) => this.handleActualTempCommandClick(e) } >{'Zjistit aktuální t.'}</button>
						<button	onClick={(e) => this.handleConfCommandClick(e) } >{'Zjistit nastavení'}</button>
					</div>

					<div style={{padding: 10}}>
						<h3>Data Log:</h3>
						<button	onClick={(e) => this.handleOnClearClick(e) }>{'Clear'}</button>
						{messages}
					</div>

					{decode}
				</section>
			</div>
		);
	}
};
