import React from 'react';

const TEST_DRUM = 'https://audio_bafuko_moe.storage.googleapis.com/drum.wav';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      loaded: false
    };
  }
  componentDidMount() {
    fetch(TEST_DRUM)
      .then(res => res.blob())
      .then(res => {
        this.drum = res;
        this.filesize = res.size;
        this.setState({ loaded: true });
      });
  }
  render() {
    if (!this.state.loaded) {
      return <>LOADING!</>;
    } else {
      return <>{this.filesize}</>;
    }
  }
}
export default App;
