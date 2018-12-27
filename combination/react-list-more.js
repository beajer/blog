import React, {PureComponent} from 'react'
import PropTypes from 'prop-types'
import ReactList from "react-list"
export default class LoadList extends PureComponent{
  static propTypes = {
    shouldLoadMore: PropTypes.func,
    loadMore: PropTypes.func,
    thumb: PropTypes.oneOfType([
      PropTypes.string,
      PropTypes.element,
      PropTypes.func,
    ]),
  }
  static defaultProps = {
    shouldLoadMore : () => false,
    loadMore: Promise.resolve.bind(Promise),
    thumb: null,
  }
  constructor(props){
    super(props)
    this.reactlist = {}
    this.state = {
      blocked: false
    }
  }
  onscroll = () => {
    let {shouldLoadMore, loadMore} = this.props
    let {state} = this.reactlist
    if(shouldLoadMore(state) && !this.state.blocked){
      this.setState({
        blocked: true
      })
      loadMore(state).finally(() => {
        this.setState({
          blocked: false
        })
      })
    }
  }
  render(){
    let {shouldLoadMore, loadMore, thumb, ...rest} = this.props
    let blocked = this.state.blocked
    thumb = typeof thumb === 'function' ? thumb() : thumb
    return <div>
      <ReactList ref={el => this.reactlist = el} {...rest}></ReactList>
      {
        blocked && thumb
      }
    </div>
  }
  componentDidMount(){
    this.reactlist.scrollParent.addEventListener('scroll', this.onscroll)
  }
  componentWillUnmount(){
    this.reactlist.scrollParent.removeEventListener('scroll', this.onscroll)
  }
}