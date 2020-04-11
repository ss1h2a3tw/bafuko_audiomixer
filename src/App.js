import React from 'react';
import './App.css';
import { encodeWAV } from './EncodeWav';

const META_URL = 'https://audio_bafuko_moe.storage.googleapis.com/meta.json';
const SAMPLE_RATE = 44100;
// sampling in 1/10 sec
const SAMPLE_BIN_DIV = 10;
// update the UI every 1000ms when playing
const UPDATE_INTERVAL = 100;
// scroll speed of the visualization. Need to be corresponded with the width of
// the width of the bars of the visualization.
const PIXEL_PER_SEC = 80;

var AudioContext = window.AudioContext || window.webkitAudioContext;
var OfflineAudioContext = window.OfflineAudioContext;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metaLoaded: false,
      audioRendered: false,
      audioRendering: false,
      audioLoaded: [],
      audioLoading: [],
      audioGain: [],
      audioOffset: [],
      audioMute: [],
      playing: false,
      paused: false,
      addingAudio: false,
      newAudioName: '',
    };
    this.playing = false;
    this.paused = false;
    this.pausedAt = 0;
    this.audio = [];
    this.intervalHandle = undefined;
    this.continueAfterRender = false;
    this.uploadFileNode = React.createRef();
  }
  startUpdateInterval() {
    if (this.intervalHandle !== undefined) {
      window.clearInterval(this.intervalHandle);
    }
    this.intervalHandle = window.setInterval(
      this.updatePlayingState.bind(this),
      UPDATE_INTERVAL
    );
  }
  stopUpdateInterval() {
    window.clearInterval(this.intervalHandle);
    this.intervalHandle = undefined;
  }
  componentDidMount() {
    this.actx = new AudioContext();
    fetch(META_URL)
      .then((res) => res.json())
      .then((res) => {
        console.log(res);
        res.forEach((now) => {
          this.addAudio(now.name, now.url, now.default);
        });
        this.setState({ metaLoaded: true });
      });
  }
  addAudio(name, url, load) {
    let newAudio = {
      name: name,
      url: url,
      gain: 100,
      mute: false,
      length: 0,
      sampleRate: 0,
      offset: 0,
      loading: load,
      loaded: false,
    };
    let idx = this.audio.push(newAudio) - 1;
    let arrayModifyHelper = (a, val, defaultVal) => {
      let ret = [...a];
      while (ret.length <= idx) {
        ret.push(defaultVal);
      }
      ret[idx] = val;
      return ret;
    };
    this.setState(
      (prevState) => {
        let nextAudioLoaded = arrayModifyHelper(
          prevState.audioLoaded,
          newAudio.loaded,
          false
        );
        let nextAudioLoading = arrayModifyHelper(
          prevState.audioLoading,
          newAudio.loading,
          false
        );
        let nextAudioGain = arrayModifyHelper(
          prevState.audioGain,
          newAudio.gain,
          100
        );
        let nextAudioMute = arrayModifyHelper(
          prevState.audioMute,
          newAudio.mute,
          false
        );
        let nextAudioOffset = arrayModifyHelper(
          prevState.audioOffset,
          newAudio.offset,
          0
        );
        return {
          audioLoaded: nextAudioLoaded,
          audioLoading: nextAudioLoading,
          audioGain: nextAudioGain,
          audioMute: nextAudioMute,
          audioOffset: nextAudioOffset,
        };
      },
      () => {
        if (load) {
          this.loadAudio(idx);
        }
      }
    );
    return idx;
  }
  setAudioLoaded(idx) {
    this.audio[idx].loaded = true;
    this.audio[idx].loading = false;
    let allLoaded = this.audio.every((element) => {
      return !element.loading;
    });
    if (allLoaded) {
      this.renderAudio();
    }
    this.setState((prevState) => {
      let nextAudioLoaded = [...prevState.audioLoaded];
      let nextAudioLoading = [...prevState.audioLoading];
      nextAudioLoaded[idx] = true;
      nextAudioLoading[idx] = false;
      return {
        audioLoaded: nextAudioLoaded,
        audioLoading: nextAudioLoading,
      };
    });
  }
  loadAudio(idx) {
    let audio = this.audio[idx];
    fetch(audio.url)
      .then((res) => res.blob())
      .then((res) => {
        audio.blob = res;
        return res.arrayBuffer();
      })
      .then((res) => this.actx.decodeAudioData(res))
      .then((buffer) => {
        audio.length = buffer.length;
        audio.sampleRate = buffer.sampleRate;
        this.genAmplitudeData(idx, buffer);
        this.setAudioLoaded(idx);
      });
  }
  loadAudioByArrayBuffer(idx, buffer) {
    let audio = this.audio[idx];
    audio.blob = new Blob([buffer]);
    this.actx.decodeAudioData(buffer).then((buffer) => {
      audio.length = buffer.length;
      audio.sampleRate = buffer.sampleRate;
      this.genAmplitudeData(idx, buffer);
      this.setAudioLoaded(idx);
    });
  }
  genAmplitudeDOM(idx) {
    let now = this.audio[idx];
    now.amplitudeDOM = now.amplitudeData.map(
      this.genAmplitudeGraphElement.bind(this, idx)
    );
  }
  genAmplitudeData(idx, audioBuffer) {
    let now = this.audio[idx];
    console.log(audioBuffer.numberOfChannels);
    console.log(audioBuffer.sampleRate);
    console.log(audioBuffer.length);
    let data = [];
    for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
      data.push(audioBuffer.getChannelData(i));
    }
    console.log(data);
    let normalized = [];
    let i = 0;
    const bin_size = audioBuffer.sampleRate / SAMPLE_BIN_DIV;
    while (i < audioBuffer.length) {
      let cnt = 0;
      let sum = 0;
      for (let j = 0; j < bin_size && i < audioBuffer.length; i++, j++) {
        for (let k = 0; k < audioBuffer.numberOfChannels; k++) {
          sum += Math.abs(data[k][i]);
          cnt++;
        }
      }
      sum /= cnt;
      normalized.push(sum);
    }
    now['amplitudeData'] = normalized;
    this.genAmplitudeDOM(idx);
    console.log(normalized);
  }
  calculateMinOffsetAndLength() {
    // max sample count (as SAMPLE_RATE)
    let maxLength = 0;
    // get the min negative offset
    let minOffset = 0;
    for (const element of this.audio) {
      if (element.loaded) {
        let length = element.length * (SAMPLE_RATE / element.sampleRate);
        length += (element.offset / 1000) * SAMPLE_RATE;
        minOffset = Math.min(minOffset, element.offset);
        maxLength = Math.max(maxLength, length);
      }
    }
    // from ms to sample count and make it positive
    this.minOffset = minOffset / 1000;
    this.length = maxLength - (minOffset * SAMPLE_RATE) / 1000;
  }
  renderAudio() {
    if (this.playing) {
      this.pause();
    }
    this.setState({ audioRendering: true });
    this.calculateMinOffsetAndLength();
    let actx = new OfflineAudioContext(2, this.length, SAMPLE_RATE);
    this.offlineActx = actx;
    this.offlineActx['actxId'] = Math.random();
    this.offlineActxId = this.offlineActx.actxId;
    let promise = [];
    for (const element of this.audio) {
      if (element.loaded) {
        let current = element.blob
          .arrayBuffer()
          .then((arrayBuffer) => actx.decodeAudioData(arrayBuffer))
          .then((audioBuffer) => {
            let sourceNode = actx.createBufferSource();
            let gainNode = actx.createGain();
            gainNode.gain.value = element.mute ? 0 : element.gain / 100;
            sourceNode.buffer = audioBuffer;
            sourceNode.connect(gainNode);
            gainNode.connect(actx.destination);
            sourceNode.start(-this.minOffset + element.offset / 1000);
          });
        promise.push(current);
      }
    }
    Promise.all(promise).then(() => {
      actx.startRendering().then((buffer) => {
        if (actx.actxId !== this.offlineActxId) {
          console.log('skip old render');
          return;
        }
        console.log('Rendering completed successfully');
        this.buffer = buffer;
        this.setState({
          audioRendered: true,
          audioRendering: false,
        });
        if (this.continueAfterRender) {
          this.startFrom(this.pausedAt);
          this.continueAfterRender = false;
        }
      });
    });
  }
  getPlayingProgress() {
    if (this.playing === false) {
      if (this.paused) {
        return this.pausedAt;
      }
      return 0;
    }
    return this.actx.getOutputTimestamp().contextTime - this.startTime;
  }
  startFrom(offset) {
    this.mainNode = this.actx.createBufferSource();
    this.mainNode.buffer = this.buffer;
    this.mainNode.connect(this.actx.destination);
    this.mainNode.onended = () => {
      this.playing = false;
      this.updatePlayingState();
    };
    this.mainNode.start(0, offset);
    this.playing = true;
    this.paused = false;
    // pretend that we started the playback previously
    this.startTime = this.actx.getOutputTimestamp().contextTime - offset;
    this.updatePlayingState();
    this.updateUI();
  }
  pause() {
    this.mainNode.stop();
    this.mainNode.disconnect();
    this.pausedAt = this.getPlayingProgress();
    this.paused = true;
    this.updatePlayingState();
    // state will change on the onended callback
  }
  togglePlay() {
    if (this.playing) {
      this.pause();
    } else {
      if (this.paused) {
        this.startFrom(this.pausedAt);
      } else {
        this.startFrom(0);
      }
    }
  }
  setVal(stateArrayName, memberName, idx, val) {
    this.audio[idx][memberName] = val;
    this.setState((prevState) => {
      let nextStateArray = [...prevState[stateArrayName]];
      nextStateArray[idx] = val;
      let nextState = { audioRendered: false };
      nextState[stateArrayName] = nextStateArray;
      return nextState;
    });
  }
  reRenderMouseUp() {
    window.removeEventListener('mouseup', this.mouseUpHandler);
    console.log('triggered');
    this.renderAudio();
  }
  reRenderWhenRelease() {
    if (this.playing) {
      this.pause();
      this.continueAfterRender = true;
    }
    this.mouseUpHandler = this.reRenderMouseUp.bind(this);
    window.addEventListener('mouseup', this.mouseUpHandler);
  }
  onChangeGain(idx, ev) {
    this.reRenderWhenRelease();
    this.setVal('audioGain', 'gain', idx, ev.target.value);
  }
  onChangeMute(idx, ev) {
    if (this.playing) {
      this.pause();
      this.continueAfterRender = true;
    }
    this.setVal('audioMute', 'mute', idx, ev.target.checked);
    this.renderAudio();
  }
  onChangeOffset(idx, ev) {
    if (this.playing) {
      this.pause();
      this.continueAfterRender = true;
    }
    this.setVal('audioOffset', 'offset', idx, ev.target.value);
    this.calculateMinOffsetAndLength();
  }
  genAmpOffset(idx) {
    let now = this.audio[idx];
    // move to center first
    let transform = 'translateX(50vw)';
    let progress =
      (this.getPlayingProgress() + this.minOffset - now.offset / 1000) *
      -PIXEL_PER_SEC;
    transform += 'translateX(' + Math.round(progress).toString() + 'px)';
    return transform;
  }
  genAmplitudeGraphElement(audioIdx, val, idx) {
    return (
      <div
        className='amp-graph-element'
        key={'ampEle' + audioIdx.toString() + '-' + idx.toString()}
        style={{ height: Math.round(1000 * val).toString() + 'px' }}
      ></div>
    );
  }
  genAmplitudeGraph(idx) {
    const name = 'amp-graph-' + idx.toString();
    this.audio[idx].amplitudeClass = name;
    return (
      <div className='amp-container'>
        <div
          className={'amp-graph ' + name}
          style={{ transform: this.genAmpOffset(idx) }}
          key={'amp' + idx.toString()}
        >
          {this.audio[idx].amplitudeDOM}
        </div>
      </div>
    );
  }
  updateUI() {
    this.updateAmplitudeOffset();
    this.updateProgressBar();
    this.updateProgressText();
    if (this.playing) {
      requestAnimationFrame(this.updateUI.bind(this));
    }
  }
  updateAmplitudeOffset() {
    for (const idx in this.audio) {
      let now = this.audio[idx];
      if (now.loaded) {
        let node = document.getElementsByClassName(now.amplitudeClass)[0];
        if (node !== undefined) {
          node.style.transform = this.genAmpOffset(idx);
        }
      }
    }
  }
  updateProgressText() {
    let node = document.getElementsByClassName('progress-text')[0];
    if (node === undefined) {
      return;
    }
    node.innerHTML = this.genProgressText();
  }
  calculateProgressPercent() {
    return (this.getPlayingProgress() / (this.length / SAMPLE_RATE)) * 100;
  }
  updateProgressBar() {
    let node = document.getElementsByClassName('progress')[0];
    node.style.width = this.calculateProgressPercent().toString() + '%';
  }
  updatePlayingState() {
    if (this.playing) {
      this.setState({
        playing: true,
        paused: false,
      });
    } else {
      if (this.paused) {
        this.setState({
          playing: false,
          paused: true,
        });
      } else {
        this.setState({ playing: false, paused: false });
      }
    }
  }
  genTimeStringFromSec(val) {
    val = Math.round(val * 1000);
    let ms = val % 1000;
    val = Math.floor(val / 1000);
    let sec = val % 60;
    val = Math.floor(val / 60);
    let min = val;
    return (
      min.toString() +
      ':' +
      sec.toString().padStart(2, '0') +
      '.' +
      ms.toString().padStart(3, '0')
    );
  }
  genProgressText() {
    return (
      this.genTimeStringFromSec(this.getPlayingProgress()) +
      ' / ' +
      this.genTimeStringFromSec(this.length / SAMPLE_RATE)
    );
  }
  genAudioDiv(idx) {
    let now = this.audio[idx];
    return (
      <div key={'audio' + idx}>
        {!now.loaded ? (
          <></>
        ) : (
          <>
            <div className='audio-name'>
              {now.name}
              {!now.loaded ? ' disabled' : ''}
            </div>
            <input
              type='checkbox'
              value={this.state.audioMute[idx]}
              disabled={!now.loaded}
              onChange={this.onChangeMute.bind(this, idx)}
            />
            <input
              type='range'
              min='0'
              max='150'
              value={this.state.audioGain[idx]}
              className='slider'
              disabled={!now.loaded}
              onChange={this.onChangeGain.bind(this, idx)}
            />
            <input
              type='number'
              step='any'
              value={this.state.audioOffset[idx]}
              onChange={this.onChangeOffset.bind(this, idx)}
            />
            {this.genAmplitudeGraph(idx)}
          </>
        )}
      </div>
    );
  }
  adjustProgressPercent(percent) {
    let length = this.length / SAMPLE_RATE;
    this.pausedAt = length * percent;
  }
  handleProgressBarMouseMove(x, width, ev) {
    let percent = (ev.clientX - x) / width;
    percent = Math.min(1, percent);
    percent = Math.max(0, percent);
    this.adjustProgressPercent(percent);
    this.updateUI();
  }
  handleProgressBarMouseUp(x, width, wasPlaying, ev) {
    window.removeEventListener('mouseup', this.mouseUpHandler);
    window.removeEventListener('mousemove', this.mouseMoveHandler);
    this.handleProgressBarMouseMove(x, width, ev);
    if (wasPlaying) {
      this.startFrom(this.pausedAt);
    }
  }
  handleProgressBarMouseDown(ev) {
    let wasPlaying = this.playing;
    if (wasPlaying) {
      this.pause();
    }
    this.paused = true;
    let node = document.getElementsByClassName('progress-bar')[0];
    let rect = node.getBoundingClientRect();
    this.mouseUpHandler = this.handleProgressBarMouseUp.bind(
      this,
      rect.x,
      rect.width,
      wasPlaying
    );
    this.mouseMoveHandler = this.handleProgressBarMouseMove.bind(
      this,
      rect.x,
      rect.width
    );
    window.addEventListener('mouseup', this.mouseUpHandler);
    window.addEventListener('mousemove', this.mouseMoveHandler);
  }
  downloadWAV() {
    let buffer = encodeWAV(this.buffer);
    let blob = new Blob([buffer], { type: 'octect/stream' });
    let url = window.URL.createObjectURL(blob);
    let a = document.createElement('a');
    a.download = 'music.wav';
    a.href = url;
    a.click();
    window.URL.revokeObjectURL(url);
  }
  isLoading() {
    return this.state.audioLoading.some((element) => {
      return element;
    });
  }
  genPlayingControl() {
    return (
      <>
        <button onClick={this.togglePlay.bind(this)}>
          {this.state.playing ? 'STOP' : 'PLAY'}
        </button>
        <button onClick={this.downloadWAV.bind(this)}>DOWNLOAD</button>
        <div className='progress-text'>{this.genProgressText()}</div>
      </>
    );
  }
  onChangeName(ev) {
    this.setState({ newAudioName: ev.target.value });
  }
  addFile() {
    if (
      this.state.newAudioName === '' ||
      this.uploadFileNode.current.files.length === 0
    ) {
      this.setState({
        errorMessage: 'Please select one file and input the track name',
      });
      return;
    }
    let idx = this.addAudio(this.state.newAudioName, 'local', false);
    const reader = new FileReader();
    reader.onload = (ev) => {
      this.loadAudioByArrayBuffer(idx, ev.target.result);
    };
    reader.readAsArrayBuffer(this.uploadFileNode.current.files[0]);
    this.setState({
      errorMessage: '',
      newAudioName: '',
      addingAudio: false,
    });
  }
  renderDialog() {
    if (!this.state.addingAudio) return <></>;
    return (
      <>
        <div className='dialog-background'></div>
        <div className='dialog-container'>
          <div className='dialog'>
            <button onClick={this.setAddingAudio.bind(this, false)}>
              Close
            </button>
            <input
              type='text'
              value={this.state.newAudioName}
              onChange={this.onChangeName.bind(this)}
            ></input>
            <input type='file' ref={this.uploadFileNode}></input>
            {this.state.errorMessage}
            <button onClick={this.addFile.bind(this)}>Add</button>
          </div>
        </div>
      </>
    );
  }
  setAddingAudio(val) {
    this.setState({ addingAudio: val });
  }
  render() {
    if (!this.state.metaLoaded) {
      return <>LOADING METADATA</>;
    } else {
      return (
        <>
          {this.state.addingAudio ? this.renderDialog() : <></>}
          <div className='top-bar'>
            <div className='add-audio-container'>
              <button onClick={this.setAddingAudio.bind(this, true)}>
                Add Track
              </button>
            </div>
            <div className='playing-control'>
              {this.isLoading()
                ? 'LOADING'
                : !this.state.audioRendered
                ? 'RENDERING'
                : this.genPlayingControl()}
            </div>
            <div
              className='progress-bar'
              onMouseDown={this.handleProgressBarMouseDown.bind(this)}
            >
              <div
                className='progress'
                style={{
                  width: this.calculateProgressPercent().toString() + '%',
                }}
              ></div>
            </div>
          </div>
          {this.audio.map((e, i) => this.genAudioDiv(i))}
        </>
      );
    }
  }
}
export default App;
