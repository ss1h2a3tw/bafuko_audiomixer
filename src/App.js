import React from 'react';

const META_URL = 'https://audio_bafuko_moe.storage.googleapis.com/meta.json';
const SAMPLE_RATE = 44100;

var AudioContext = window.AudioContext || window.webkitAudioContext;
var OfflineAudioContext = window.OfflineAudioContext;

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      metaLoaded: false,
      audioRendered: false,
      audioRendering: true,
      audioLoaded: [],
      audioLoading: [],
      audioGain: [],
      audioMute: [],
      playing: false,
    };
    this.audio = [];
  }
  componentDidMount() {
    this.actx = new AudioContext();
    fetch(META_URL)
      .then((res) => res.json())
      .then((res) => {
        let pendingToLoad = [];
        this.audio = res;
        for (let audioElement of res) {
          audioElement['gain'] = 100;
          audioElement['mute'] = false;
          audioElement['length'] = 0;
          audioElement['sampleRate'] = 0;
          audioElement['offset'] = 0;
          audioElement['loaded'] = false;
          audioElement['loading'] = false;
        }
        let nextState = {
          metaLoaded: true,
          audioLoaded: [],
          audioLoading: [],
          audioGain: [],
          audioMute: [],
        };
        for (const idx in res) {
          nextState.audioLoaded.push(false);
          nextState.audioLoading.push(res[idx].default);
          nextState.audioGain.push(100);
          nextState.audioMute.push(false);
          this.audio[idx].loading = res[idx].default;
          if (res[idx].default) {
            pendingToLoad.push(idx);
          }
        }
        this.setState(nextState, () => {
          for (const idx of pendingToLoad) {
            this.loadAudio(idx);
          }
        });
      });
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
        this.setAudioLoaded(idx);
      });
  }
  renderAudio() {
    if (this.playing) {
      this.mainNode.stop();
    }
    // max sample count (as SAMPLE_RATE)
    let maxLength = 0;
    // get the min negative offset
    let minOffset = 0;
    for (const element of this.audio) {
      if (element.loaded) {
        const length = element.length * (SAMPLE_RATE / element.sampleRate);
        minOffset = Math.min(minOffset, element.offset);
        maxLength = Math.max(maxLength, length);
      }
    }
    // from ms to sample count and make it positive
    minOffset *= -(SAMPLE_RATE / 1000);
    this.length = maxLength + minOffset;
    let actx = new OfflineAudioContext(2, this.length, SAMPLE_RATE);
    this.offlineActx = actx;
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
            sourceNode.start(minOffset + element.offset * (SAMPLE_RATE / 1000));
          });
        promise.push(current);
      }
    }
    Promise.all(promise).then(() => {
      actx.startRendering().then((buffer) => {
        console.log('Rendering completed successfully');
        this.buffer = buffer;
        this.setState({
          audioRendered: true,
          audioRendering: false,
        });
      });
    });
  }
  getPlayingProgress() {
    console.log(this.actx.getOutputTimestamp().contextTime - this.startTime);
    return this.actx.getOutputTimestamp().contextTime - this.startTime;
  }
  startFrom(offset) {
    this.mainNode = this.actx.createBufferSource();
    this.mainNode.buffer = this.buffer;
    this.mainNode.connect(this.actx.destination);
    this.mainNode.onended = () => {
      this.playing = false;
      this.setState({ playing: false });
    };
    this.mainNode.start(0, offset);
    this.playing = true;
    // pretend that we started the playback previously
    this.startTime = this.actx.getOutputTimestamp().contextTime - offset;
    this.setState({ playing: true });
  }
  togglePlay() {
    if (this.playing) {
      this.mainNode.stop();
      this.mainNode.disconnect();
      this.pausedAt = this.getPlayingProgress();
      this.paused = true;
      // state will change on the onended callback
    } else {
      if (this.paused) {
        this.startFrom(this.pausedAt);
      } else {
        this.startFrom(0);
      }
      this.paused = false;
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
  onChangeGain(idx, ev) {
    this.setVal('audioGain', 'gain', idx, ev.target.value);
  }
  onChangeMute(idx, ev) {
    console.log(ev);
    this.setVal('audioMute', 'mute', idx, ev.target.checked);
  }
  genAudioDiv(idx) {
    let now = this.audio[idx];
    return (
      <div key={'audio' + idx}>
        <div className='audioName'>
          {now.name}
          {!now.loaded ? ' disabled' : ''}
        </div>
        {!now.loaded ? (
          <></>
        ) : (
          <>
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
          </>
        )}
      </div>
    );
  }
  isLoading() {
    return this.state.audioLoading.some((element) => {
      return element;
    });
  }
  render() {
    if (!this.state.metaLoaded || this.isLoading()) {
      return <>LOADING!</>;
    } else {
      return (
        <>
          {this.state.audioRendering ? 'RENDERING!' : ''}
          {!this.state.audioRendering && !this.state.audioRendered ? (
            <button onClick={this.renderAudio.bind(this)}>RENDER</button>
          ) : (
            <></>
          )}
          <button onClick={this.togglePlay.bind(this)}>
            {this.state.playing ? 'STOP' : 'PLAY'}
          </button>
          <button onClick={this.getPlayingProgress.bind(this)}>DEBUG</button>
          {this.audio.map((e, i) => this.genAudioDiv(i))}
        </>
      );
    }
  }
}
export default App;
